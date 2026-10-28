/** Apply explicit account mutations using fresh browser-local identity and records. */
import { getSession } from './auth.js';
import { getUsers, saveUsers } from './storage.js';

/** Describe a persistence-first account result.
 * @typedef {Object} UserResult
 * @property {boolean} ok Whether the account collection was saved.
 * @property {Object} [user] Selected canonical account on success.
 * @property {Object[]} [users] Complete saved collection on success.
 * @property {string} [code] Stable failure category.
 * @property {string} [message] Actionable non-sensitive feedback.
 * @property {Object<string, string>} [errors] Form field feedback.
 */

/** Return a failure without writing or exposing account credentials. */
function failure(code, message, errors) {
  return { ok: false, code, message, ...(errors ? { errors } : {}) };
}

/** Require a freshly read admin principal for every mutation. */
function requireAdmin() {
  const session = getSession();
  if (!session) return failure('SESSION_REQUIRED', 'Your session ended. Log in as an admin before changing accounts.');
  if (session.role !== 'admin') return failure('PERMISSION_DENIED', 'Admin access is required to change accounts.');
  return { ok: true, session };
}

/** Persist only users and return saved data only after storage accepts it. */
function persist(users, user, action) {
  if (!saveUsers(users)) {
    return failure('STORAGE_WRITE_FAILED', `Could not ${action} this account. Check browser storage before trying again.`);
  }
  return { ok: true, user, users };
}

/** Create a canonical local account; ignore caller-supplied identity and extra fields.
 * Args:
 *   values: Required display name, exact username, plaintext demo password and role.
 * Returns:
 *   Saved account and collection, or validation/permission/persistence failure.
 * @param {Object} values
 * @returns {UserResult}
 */
export function createUser(values) {
  const access = requireAdmin();
  if (!access.ok) return access;
  const errors = {};
  const displayName = typeof values?.displayName === 'string' ? values.displayName.trim() : '';
  const username = typeof values?.username === 'string' ? values.username : '';
  const password = typeof values?.password === 'string' ? values.password : '';
  const role = values?.role;
  if (!displayName) errors.displayName = 'Display name is required.';
  if (!username.trim()) errors.username = 'Username is required.';
  if (!password.trim()) errors.password = 'Password is required.';
  if (!role) errors.role = 'Role is required.';
  else if (!['admin', 'user'].includes(role)) errors.role = 'Choose Admin or User.';
  if (Object.keys(errors).length) return failure('VALIDATION_FAILED', 'Complete the required account fields.', errors);
  const users = getUsers();
  if (username === 'admin') {
    return failure('RESERVED_USERNAME', 'The username admin is reserved.', { username: 'The username admin is reserved.' });
  }
  if (users.some((user) => user.username === username)) {
    return failure('DUPLICATE_USERNAME', 'That username is already in use.', { username: 'That username is already in use.' });
  }
  let user;
  try {
    user = { id: crypto.randomUUID(), displayName, username, password, role, createdAt: new Date().toISOString() };
  } catch {
    return failure('UUID_UNAVAILABLE', 'Could not create an account ID. Use a browser with secure UUID support.');
  }
  return persist([...users, user], user, 'create');
}

/** Delete a fresh target after the caller confirms; never alter authored posts.
 * Args:
 *   id: Selected account identifier, not a cached record or principal.
 * Returns:
 *   Removed account and saved remaining collection, or a fail-closed result.
 * Notes:
 *   The logical built-in admin is immutable even when absent from local users.
 * @param {string} id
 * @returns {UserResult}
 */
export function deleteUser(id) {
  const access = requireAdmin();
  if (!access.ok) return access;
  const users = getUsers();
  if (id === 'admin') return failure('PROTECTED_ACCOUNT', 'Default admin cannot be deleted.');
  const user = users.find((record) => record.id === id);
  if (!user) return failure('USER_NOT_FOUND', 'Account not found. Choose an existing account.');
  if (user.id === access.session.userId) return failure('SELF_DELETE_FORBIDDEN', 'You cannot delete your current account.');
  return persist(users.filter((record) => record.id !== id), user, 'delete');
}
