/** Present an account as a desktop row and mobile card without storage access. */
import PropTypes from 'prop-types';
import { Avatar } from './Avatar.jsx';

const badges = {
  admin: 'bg-violet-100 text-violet-700 ring-violet-300',
  user: 'bg-indigo-100 text-indigo-700 ring-indigo-300',
};

/** Show public account fields and expose deletion only for eligible admin targets.
 * Args:
 *   user: Account display record; passwords are never inspected or rendered.
 *   session: Principal supplied by the caller, or null for a guest.
 *   onDelete: Intent callback receiving only the selected account identifier.
 * Notes:
 *   CSS preserves table semantics on desktop and card grouping on mobile.
 */
export function UserRow({ user, session, onDelete }) {
  const protectedAccount = user.id === 'admin';
  const self = user.id === session?.userId;
  const eligible = session?.role === 'admin' && !protectedAccount && !self;
  return (
    <tr className="mb-4 block rounded-lg border border-slate-200 bg-white p-4 sm:mb-0 sm:table-row sm:rounded-none sm:border-0 sm:border-b sm:p-0">
      <th scope="row" className="block text-left font-normal sm:table-cell sm:px-5 sm:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar role={user.role} />
          <span className="break-words font-medium">{user.displayName}</span>
        </div>
      </th>
      <td className="mt-3 block break-all text-sm text-slate-600 sm:mt-0 sm:table-cell sm:px-5 sm:py-4">
        <span className="mr-2 font-medium sm:hidden">Username</span>
        <span>@{user.username}</span>
      </td>
      <td className="mt-3 block sm:mt-0 sm:table-cell sm:px-5 sm:py-4">
        <span className="mr-2 text-sm font-medium sm:hidden">Role</span>
        <span className={`inline-block rounded-full px-3 py-0.5 text-sm font-medium ring-1 ${badges[user.role]}`}>
          {user.role === 'admin' ? 'Admin' : 'User'}
        </span>
      </td>
      <td className="mt-3 block text-sm text-slate-500 sm:mt-0 sm:table-cell sm:px-5 sm:py-4">
        {protectedAccount ? 'Built-in account' : (
          <time dateTime={user.createdAt}>
            {new Date(user.createdAt).toLocaleDateString('en-US', {
              month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC',
            })}
          </time>
        )}
      </td>
      <td className="mt-4 block sm:mt-0 sm:table-cell sm:px-5 sm:py-4">
        {eligible ? (
          <button
            type="button"
            aria-label={`Delete ${user.username}`}
            onClick={() => onDelete(user.id)}
            className="min-h-11 rounded-lg border border-red-200 bg-red-50 px-4 py-2 font-medium text-red-600
              hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500
              focus-visible:ring-offset-2 motion-safe:transition-colors"
          >
            Delete
          </button>
        ) : (
          <span className="text-sm text-slate-600">
            {protectedAccount ? 'Protected' : self ? 'Current account' : 'Admin access required'}
          </span>
        )}
      </td>
    </tr>
  );
}

UserRow.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['admin', 'user']).isRequired,
    createdAt: PropTypes.string,
  }).isRequired,
  session: PropTypes.shape({ userId: PropTypes.string.isRequired, role: PropTypes.oneOf(['admin', 'user']).isRequired }),
  onDelete: PropTypes.func.isRequired,
};
