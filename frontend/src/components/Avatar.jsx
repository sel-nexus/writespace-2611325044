/** Present static role avatars without persistence or external services. */
import PropTypes from 'prop-types';

/** Select a static crown for admins and a book for everyone else.
 * Args:
 *   role: Principal role; unsupported or missing roles use the reader avatar.
 * Returns:
 *   Decorative role avatar JSX.
 */
export function getAvatar(role) {
  return (
    <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${role === 'admin' ? 'bg-violet-600' : 'bg-indigo-500'}`}>
      {role === 'admin' ? '👑' : '📚'}
    </span>
  );
}

/** Render the shared decorative avatar for a principal.
 * Args:
 *   role: Supported principal role, defaulting to reader.
 */
export function Avatar({ role = 'user' }) {
  return getAvatar(role);
}

Avatar.propTypes = { role: PropTypes.oneOf(['admin', 'user']) };
