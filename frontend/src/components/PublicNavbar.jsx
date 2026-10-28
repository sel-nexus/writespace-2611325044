/** Present session-aware public navigation with an accessible mobile disclosure. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { NavLink, useLocation } from 'react-router-dom';

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';
const linkStyle = `rounded-full px-4 py-2 font-medium hover:bg-indigo-50 ${focus}`;

/** Render the public shell without reading or writing persistent data.
 * Args:
 *   session: Validated principal supplied by the route composition, or null.
 * Returns:
 *   Sticky navigation with guest or role-specific entry links.
 */
export function PublicNavbar({ session = null }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setOpen(false); }, [location]);

  const entries = session
    ? [{ label: 'Dashboard', to: session.role === 'admin' ? '/admin' : '/blogs', primary: true }]
    : [{ label: 'Login', to: '/login' }, { label: 'Get Started', to: '/register', primary: true }];

  return (
    <header className="sticky top-0 z-20 border-b border-slate-100 bg-white shadow-sm">
      <a href="#main-content" className={`sr-only rounded-lg bg-white p-3 focus:not-sr-only focus:absolute ${focus}`}>
        Skip to content
      </a>
      <nav aria-label="Public navigation" className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <NavLink to="/" end className={`flex items-center gap-2 rounded-lg text-xl font-bold tracking-tight ${focus}`}>
          <img src="/favicon.svg" alt="" width="32" height="32" />
          WriteSpace
        </NavLink>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="public-navigation-links"
          onClick={() => setOpen(!open)}
          className={`min-h-11 rounded-lg border border-slate-200 px-3 font-medium sm:hidden ${focus}`}
        >
          {open ? 'Close menu' : 'Open menu'}
        </button>
        <div id="public-navigation-links" className={`${open ? 'flex' : 'hidden'} w-full flex-col gap-2 sm:flex sm:w-auto sm:flex-row sm:items-center`}>
          {session && (
            <span className="flex min-w-0 items-center gap-2 px-3 py-2">
              <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${session.role === 'admin' ? 'bg-violet-600' : 'bg-indigo-500'}`}>
                {session.role === 'admin' ? '👑' : '📚'}
              </span>
              <span className="max-w-48 truncate font-medium">{session.displayName}</span>
            </span>
          )}
          {entries.map(({ label, to, primary }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `${linkStyle} ${primary || isActive ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700' : 'text-slate-800'}`}>
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  );
}

PublicNavbar.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['admin', 'user']).isRequired,
  }),
};
