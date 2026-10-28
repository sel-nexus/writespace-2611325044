/** Validate whole browser-local collections without repairing data during reads. */

/** Check the required nonempty string fields of a record.
 * Args:
 *   record: Candidate persisted record.
 *   fields: Required textual fields.
 * Returns:
 *   Whether every field is usable.
 */
function hasText(record, fields) {
  return record !== null && typeof record === 'object' && !Array.isArray(record)
    && fields.every((field) => typeof record[field] === 'string' && record[field].trim().length > 0);
}

/** Check a persisted timestamp for an ISO date-time and a real calendar date. */
function hasTimestamp(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value.slice(0, 10);
}

/** Validate the complete post contract before accepting a collection. */
function isPost(record) {
  return hasText(record, ['id', 'title', 'content', 'authorId', 'authorName']) && hasTimestamp(record.createdAt);
}

/** Validate the complete canonical user contract, including supported roles. */
function isUser(record) {
  return hasText(record, ['id', 'displayName', 'username', 'password'])
    && ['admin', 'user'].includes(record.role) && hasTimestamp(record.createdAt);
}

/** Reject an entire collection when any record or sparse slot is invalid. */
function isCollection(value, validate) {
  return Array.isArray(value) && Array.from(value).every(validate);
}

/** Read a collection without mutating even malformed persisted bytes.
 * Returns:
 *   The whole validated array, or an empty rendering fallback on any failure.
 */
function readCollection(key, validate) {
  try {
    const value = JSON.parse(window.localStorage.getItem(key));
    return isCollection(value, validate) ? value : [];
  } catch {
    return [];
  }
}

/** Serialize and validate replacement bytes before a guarded write.
 * Returns:
 *   True only after storage accepts the complete replacement.
 */
function writeCollection(key, records, validate) {
  try {
    if (!isCollection(records, validate)) return false;
    const serialized = JSON.stringify(records);
    if (!isCollection(JSON.parse(serialized), validate)) return false;
    window.localStorage.setItem(key, serialized);
    return true;
  } catch {
    return false;
  }
}

/** Read validated posts; return an empty array on absent, corrupt, or inaccessible storage. */
export function getPosts() { return readCollection('writespace_posts', isPost); }

/** Replace posts explicitly.
 * Args:
 *   posts: Complete replacement post collection.
 * Returns:
 *   Whether validation, serialization, and persistence succeeded.
 */
export function savePosts(posts) { return writeCollection('writespace_posts', posts, isPost); }

/** Read validated users without restoring or synthesizing accounts. */
export function getUsers() { return readCollection('writespace_users', isUser); }

/** Replace users explicitly.
 * Args:
 *   users: Complete replacement canonical account collection.
 * Returns:
 *   Whether validation, serialization, and persistence succeeded.
 */
export function saveUsers(users) { return writeCollection('writespace_users', users, isUser); }
