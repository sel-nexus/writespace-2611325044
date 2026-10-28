/** Provide explicitly insecure browser-local demo account entry. */
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { getSession, setSession } from '../utils/auth.js';
import { getUsers } from '../utils/storage.js';

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';

/** Validate exact credentials, persist identity, and route only on success. */
export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();
  const session = getSession();
  if (session) return <Navigate to={session.role === 'admin' ? '/admin' : '/blogs'} replace />;

  /** Match the built-in admin before local accounts and surface persistence failure. */
  function submit(event) {
    event.preventDefault();
    const required = {};
    if (!username.trim()) required.username = 'Username is required.';
    if (!password.trim()) required.password = 'Password is required.';
    if (Object.keys(required).length) {
      setErrors(required);
      return;
    }
    const principal = username === 'admin' && password === 'admin'
      ? { id: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' }
      : getUsers().find((user) => user.username === username && user.password === password);
    if (!principal) {
      setErrors({ form: 'Invalid username or password.' });
      return;
    }
    const next = { userId: principal.id, username: principal.username, displayName: principal.displayName, role: principal.role };
    if (!setSession(next)) {
      setErrors({ form: 'Could not save your session. Please check browser storage and try again.' });
      return;
    }
    navigate(next.role === 'admin' ? '/admin' : '/blogs');
  }

  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-[85dvh] items-center justify-center px-4 py-16 sm:px-6">
      <section aria-labelledby="login-heading" className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-lg sm:p-10">
        <img src="/favicon.svg" alt="WriteSpace" width="44" height="44" />
        <p className="mt-6 text-sm font-medium uppercase tracking-widest text-indigo-700">Your writing space</p>
        <h1 id="login-heading" className="mt-3 font-display text-4xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-3 text-slate-600">Log in to read, write, and make space for your thoughts.</p>
        <form onSubmit={submit} noValidate className="mt-8 space-y-5">
          <div>
            <label htmlFor="login-username" className="block font-medium">Username</label>
            <input
              id="login-username"
              name="username"
              autoComplete="username"
              required
              aria-required="true"
              aria-invalid={Boolean(errors.username || errors.form)}
              aria-describedby={errors.username ? 'username-error' : errors.form ? 'login-error' : undefined}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className={`mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 ${focus}`}
            />
            {errors.username && (
              <p id="username-error" role="alert" className="mt-2 text-sm text-red-700">
                {errors.username}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="login-password" className="block font-medium">Password</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              aria-required="true"
              aria-invalid={Boolean(errors.password || errors.form)}
              aria-describedby={errors.password ? 'password-error' : errors.form ? 'login-error' : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={`mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 ${focus}`}
            />
            {errors.password && (
              <p id="password-error" role="alert" className="mt-2 text-sm text-red-700">
                {errors.password}
              </p>
            )}
          </div>
          {errors.form && (
            <p id="login-error" role="alert" className="text-sm text-red-700">
              {errors.form}
            </p>
          )}
          <button
            type="submit"
            className={`min-h-11 w-full rounded-full bg-indigo-600 px-4 py-3 font-medium text-white shadow-sm hover:bg-indigo-700 ${focus}`}
          >
            Login
          </button>
        </form>
        <p className="mt-6 text-sm text-slate-600">
          {'New here? '}
          <Link
            to="/register"
            className={`rounded text-indigo-700 underline underline-offset-4 ${focus}`}
          >
            Create an account
          </Link>
        </p>
        <p className="mt-6 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-800">Demo admin: username admin, password admin.</p>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          Demo only: passwords are stored in plain text and access checks run in your browser. Do not use real passwords or sensitive data.
        </p>
      </section>
    </main>
  );
}
