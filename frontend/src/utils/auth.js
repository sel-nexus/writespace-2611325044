/** Guard browser-local session operations; never synthesize identity on reads. */

/** Accept only a complete session with a supported role. */
function isSession(session) {
  return session !== null && typeof session === 'object' && !Array.isArray(session)
    && ['userId', 'username', 'displayName'].every((field) => typeof session[field] === 'string' && session[field].trim().length > 0)
    && ['admin', 'user'].includes(session.role);
}

/** Read the current principal without changing persistence.
 * Returns:
 *   A valid session or null on any absent, malformed, or unavailable value.
 */
export function getSession() {
  try {
    const session = JSON.parse(window.localStorage.getItem('writespace_session'));
    return isSession(session) ? session : null;
  } catch {
    return null;
  }
}

/** Persist an explicitly selected principal.
 * Args:
 *   session: Complete browser-local principal.
 * Returns:
 *   True only after valid serialized bytes are written; false on any failure.
 */
export function setSession(session) {
  try {
    if (!isSession(session)) return false;
    const serialized = JSON.stringify(session);
    if (!isSession(JSON.parse(serialized))) return false;
    window.localStorage.setItem('writespace_session', serialized);
    return true;
  } catch {
    return false;
  }
}

/** Remove only the session key after an explicit logout action.
 * Returns:
 *   True after successful removal, including an already absent session.
 */
export function clearSession() {
  try {
    window.localStorage.removeItem('writespace_session');
    return true;
  } catch {
    return false;
  }
}
