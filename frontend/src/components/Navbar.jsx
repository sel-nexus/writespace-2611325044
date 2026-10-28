/** Present authenticated role navigation and explicit, guarded logout. */
import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { flushSync } from 'react-dom';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { clearSession } from '../utils/auth.js';
import { Avatar } from './Avatar.jsx';

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';

/** Render role links and retain the view when session removal fails.
 * Args:
 *   session: Validated principal supplied by the shell.
 *   onLogout: Optional shell notification after successful session removal.
 */
export function Navbar({ session, onLogout }) {
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [error, setError] = useState('');
  const accountTrigger = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    setOpen(false);
    setAccountOpen(false);
    setError('');
  }, [location]);

  const entries = session.role === 'admin'
    ? [['Dashboard', '/admin'], ['Blogs', '/blogs'], ['Write', '/write'], ['Users', '/users']]
    : [['Blogs', '/blogs'], ['Write', '/write']];

  /** Remove only identity, then notify the shell and return to discovery. */
  function logout() {
    if (!clearSession()) {
      setError('Could not log out. Your session was not removed. Please try again.');
      return;
    }
    // Commit the public route before clearing shell state so a mounted guard
    // cannot race this deliberate logout with its guest-to-login redirect.
    flushSync(() => navigate('/'));
    onLogout?.();
  }

  /** Close the account disclosure on Escape and restore its trigger focus. */
  function closeAccount(event) {
    if (event.key === 'Escape') {
      setAccountOpen(false);
      accountTrigger.current?.focus();
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-100 bg-white shadow-sm">
      <a href="#main-content" className={`sr-only rounded-lg bg-white p-3 focus:not-sr-only focus:absolute ${focus}`}>
        Skip to content
      </a>
      <nav aria-label="Account navigation" className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <NavLink to="/" end className={`flex items-center gap-2 rounded-lg text-xl font-bold tracking-tight ${focus}`}>
          <img src="/favicon.svg" alt="" width="32" height="32" />
          WriteSpace
        </NavLink>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="account-navigation-links"
          onClick={() => setOpen(!open)}
          className={`min-h-11 rounded-lg border border-slate-200 px-3 font-medium sm:hidden ${focus}`}
        >
          {open ? 'Close menu' : 'Open menu'}
        </button>
        <div
          id="account-navigation-links"
          className={`${open ? 'flex' : 'hidden'} w-full flex-col gap-2 sm:flex sm:w-auto sm:flex-row sm:items-center`}
        >
          {entries.map(([label, to]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `rounded-full px-4 py-2 font-medium ${focus} ${isActive ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700' : 'text-slate-800 hover:bg-indigo-50'}`}
            >
              {label}
            </NavLink>
          ))}
          <div className="relative" onKeyDown={closeAccount}>
            <button
              ref={accountTrigger}
              type="button"
              aria-expanded={accountOpen}
              aria-controls="account-dropdown"
              onClick={() => setAccountOpen(!accountOpen)}
              className={`flex min-h-11 items-center gap-2 rounded-full px-3 py-2 hover:bg-slate-100 ${focus}`}
            >
              <Avatar role={session.role} />
              <span className="max-w-48 truncate font-medium">{session.displayName}</span>
              <span className="sr-only">account</span>
            </button>
            {accountOpen && (
              <div id="account-dropdown" className="mt-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:absolute sm:right-0 sm:min-w-56">
                <p className="break-words px-3 py-2 text-sm text-slate-500">
                  @
                  {session.username}
                </p>
                <button
                  type="button"
                  onClick={logout}
                  className={`min-h-11 w-full rounded-lg px-3 py-2 text-left font-medium text-red-700 hover:bg-red-50 ${focus}`}
                >
                  Logout
                </button>
                {error && (
                  <p role="alert" className="mt-2 text-sm text-red-700">
                    {error}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>
      <p className="mx-auto max-w-6xl px-4 pb-3 text-xs leading-relaxed text-slate-500 sm:px-6">
        Demo only: passwords are stored in plain text and access checks run in your browser. Do not use real passwords or sensitive data.
      </p>
    </header>
  );
}

Navbar.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['admin', 'user']).isRequired,
  }).isRequired,
  onLogout: PropTypes.func,
};
