/** Apply explicit post mutations against fresh browser-local identity and records. */
import { getSession } from './auth.js';
import { getPosts, savePosts } from './storage.js';

/** Describe a mutation outcome shared by writing, reading, and dashboard controls.
 * @typedef {Object} PostResult
 * @property {boolean} ok Whether persistence completed.
 * @property {Object} [post] Created, edited, or deleted record on success.
 * @property {Object[]} [posts] Complete persisted collection on success.
 * @property {string} [code] Stable failure category.
 * @property {string} [message] Actionable failure feedback.
 * @property {Object<string, string>} [errors] Required-field feedback.
 */

/** Fail without writing or advertising a successful mutation. */
function failure(code, message, errors) {
  return { ok: false, code, message, ...(errors ? { errors } : {}) };
}

/** Check owner/admin eligibility without reading or writing storage.
 * Args:
 *   post: Saved target record, if available.
 *   session: Current validated principal, if available.
 * Returns:
 *   Whether this principal may edit or delete the record.
 * @param {Object|null} post
 * @param {Object|null} session
 * @returns {boolean}
 */
export function canManagePost(post, session) {
  return Boolean(post && session && typeof post.authorId === 'string' && post.authorId.trim()
    && typeof session.userId === 'string' && session.userId.trim()
    && ['user', 'admin'].includes(session.role)
    && (session.role === 'admin' || post.authorId === session.userId));
}

/** Validate and normalize only the editable text supplied by a caller. */
function validate(values) {
  const title = typeof values?.title === 'string' ? values.title.trim() : '';
  const content = typeof values?.content === 'string' ? values.content.trim() : '';
  const errors = {};
  if (!title) errors.title = 'Title is required.';
  if (!content) errors.content = 'Content is required.';
  return Object.keys(errors).length
    ? failure('VALIDATION_FAILED', 'Enter a title and content before saving.', errors)
    : { ok: true, title, content };
}

/** Persist one collection and return data only after a successful write. */
function persist(posts, post, action) {
  if (!savePosts(posts)) {
    return failure('STORAGE_WRITE_FAILED', `Could not ${action} this post. Check browser storage before trying again.`);
  }
  return { ok: true, post, posts };
}

/** Create a post using the session and collection read at this explicit action.
 * Args:
 *   values: Title and plaintext content; caller-supplied identity is ignored.
 * Returns:
 *   Persisted record/collection or an actionable failure; never navigates.
 * @param {Object} values
 * @returns {PostResult}
 */
export function createPost(values) {
  const session = getSession();
  const posts = getPosts();
  if (!session) return failure('SESSION_REQUIRED', 'Your session ended. Log in again before saving this post.');
  const text = validate(values);
  if (!text.ok) return text;
  let post;
  try {
    post = {
      id: crypto.randomUUID(),
      title: text.title,
      content: text.content,
      createdAt: new Date().toISOString(),
      authorId: session.userId,
      authorName: session.displayName,
    };
  } catch {
    return failure('UUID_UNAVAILABLE', 'Could not create a post ID. Use a browser with secure UUID support.');
  }
  return persist([...posts, post], post, 'save');
}

/** Resolve a fresh target and principal for an edit or delete action. */
function target(id) {
  const session = getSession();
  const posts = getPosts();
  if (!session) return failure('SESSION_REQUIRED', 'Your session ended. Log in again before changing this post.');
  const post = posts.find((record) => record.id === id);
  if (!post) return failure('POST_NOT_FOUND', 'Post not found. Return to blogs to choose an existing post.');
  if (!canManagePost(post, session)) {
    return failure('PERMISSION_DENIED', 'You can only manage your own posts. Return to blogs or sign in as the owner.');
  }
  return { ok: true, post, posts };
}

/** Edit only title/content on the fresh persisted record, retaining all identity.
 * Args:
 *   id: Selected saved post identifier.
 *   values: New title and plaintext content.
 * Returns:
 *   Persisted record/collection or an actionable failure.
 * @param {string} id
 * @param {Object} values
 * @returns {PostResult}
 */
export function editPost(id, values) {
  const current = target(id);
  if (!current.ok) return current;
  const text = validate(values);
  if (!text.ok) return text;
  const post = { ...current.post, title: text.title, content: text.content };
  const posts = current.posts.map((record) => record.id === id ? post : record);
  return persist(posts, post, 'save');
}

/** Delete only the selected identifier after the caller obtains confirmation.
 * Args:
 *   id: Selected saved post identifier; never a stale record or session.
 * Returns:
 *   Deleted record and persisted remaining collection, or actionable failure.
 * Notes:
 *   The UI owns window.confirm; this helper repeats current permission checks.
 * @param {string} id
 * @returns {PostResult}
 */
export function deletePost(id) {
  const current = target(id);
  if (!current.ok) return current;
  return persist(current.posts.filter((record) => record.id !== id), current.post, 'delete');
}
