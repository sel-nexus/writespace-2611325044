/** Manage demo accounts through explicit, admin-only persistence-first actions. */
import { useState } from 'react';
import { ProtectedRoute } from '../components/ProtectedRoute.jsx';
import { UserRow } from '../components/UserRow.jsx';
import { getSession } from '../utils/auth.js';
import { getUsers } from '../utils/storage.js';
import { createUser, deleteUser } from '../utils/users.js';

const emptyForm = { displayName: '', username: '', password: '', role: '' };
const builtInAdmin = { id: 'admin', displayName: 'Admin', username: 'admin', role: 'admin' };
const fields = [['displayName', 'Display Name'], ['username', 'Username'], ['password', 'Password'], ['role', 'Role']];
const inputStyle = 'mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2';

/** Render the guarded account working view without mutation during mount. */
function ManagementContent() {
  const [users, setUsers] = useState(getUsers);
  const [session] = useState(getSession);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const visibleUsers = [builtInAdmin, ...users.filter((user) => user.id !== 'admin')];

  /** Collect field edits without writing account data. */
  function change(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  /** Retain entered values on failure and reset only after account persistence. */
  function submit(event) {
    event.preventDefault();
    setStatus('');
    const result = createUser(form);
    setErrors(result.errors ?? {});
    if (!result.ok) {
      setError(result.errors ? '' : result.message);
      return;
    }
    setUsers(result.users);
    setForm(emptyForm);
    setError('');
    setStatus(`Account created for ${result.user.username}.`);
  }

  /** Confirm deliberate intent before the helper re-reads permission and target. */
  function remove(id) {
    const current = getSession();
    if (current?.role !== 'admin') {
      setStatus('');
      setError('Admin access is required to change accounts.');
      return;
    }
    if (id === 'admin' || id === current.userId) {
      setStatus('');
      setError(id === 'admin' ? 'Default admin cannot be deleted.' : 'You cannot delete your current account.');
      return;
    }
    if (!window.confirm('Delete this account? This cannot be undone. Posts will not be changed.')) return;
    const result = deleteUser(id);
    setStatus('');
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setUsers(result.users);
    setError('');
    setStatus('Account deleted. Posts were not changed.');
  }

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto min-h-[70dvh] max-w-6xl px-4 py-12 sm:px-6">
      <header>
        <h1 className="font-display text-4xl font-bold">User management</h1>
        <p className="mt-4 max-w-2xl text-slate-600">
          Create accounts and manage roles in this browser. Removing an account does not change its posts.
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-600">
          Demo only: passwords are stored in plain text and access checks run in your browser. Do not use real passwords or sensitive data.
        </p>
      </header>
      <section aria-labelledby="create-account-heading" className="mt-8 rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
        <h2 id="create-account-heading" className="font-display text-2xl font-bold">Create a local account</h2>
        <form noValidate onSubmit={submit} className="mt-5 grid gap-5 sm:grid-cols-2">
          {fields.map(([name, label]) => (
            <div key={name}>
              <label htmlFor={`user-${name}`} className="block text-sm font-medium">{label}</label>
              {name === 'role' ? (
                <select
                  id={`user-${name}`}
                  name={name}
                  value={form[name]}
                  onChange={change}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(errors[name])}
                  aria-describedby={errors[name] ? `user-${name}-error` : undefined}
                  className={inputStyle}
                >
                  <option value="">Choose a role</option>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              ) : (
                <input
                  id={`user-${name}`}
                  name={name}
                  type={name === 'password' ? 'password' : 'text'}
                  autoComplete={name === 'password' ? 'new-password' : 'off'}
                  value={form[name]}
                  onChange={change}
                  required
                  aria-required="true"
                  aria-invalid={Boolean(errors[name])}
                  aria-describedby={errors[name] ? `user-${name}-error` : undefined}
                  className={inputStyle}
                />
              )}
              {errors[name] && (
                <p id={`user-${name}-error`} role="alert" className="mt-2 text-sm text-red-700">
                  {errors[name]}
                </p>
              )}
            </div>
          ))}
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="min-h-11 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 motion-safe:transition-colors"
            >
              Create account
            </button>
          </div>
        </form>
      </section>
      {error && (
        <p role="alert" className="mt-5 text-sm text-red-700">{error}</p>
      )}
      <p role="status" className="mt-4 text-sm text-slate-600">{status}</p>
      <section aria-labelledby="accounts-heading" className="mt-8">
        <h2 id="accounts-heading" className="font-display text-2xl font-bold">Accounts in this browser</h2>
        {users.length === 0 && (
          <p className="mt-3 text-slate-600">No local accounts yet. The built-in admin is always available.</p>
        )}
        <table className="mt-5 block w-full table-fixed text-left sm:table">
          <caption className="sr-only">Demo accounts, roles and eligible deletion actions</caption>
          <thead className="hidden text-sm text-slate-600 sm:table-header-group">
            <tr>
              {['Display name', 'Username', 'Role', 'Created', 'Actions'].map((label) => (
                <th key={label} scope="col" className="px-5 py-3 font-medium">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="block sm:table-row-group">
            {visibleUsers.map((user) => (
              <UserRow key={user.id} user={user} session={session} onDelete={remove} />
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

/** Guard direct page use as well as the admin-only route. */
export default function UserManagement() {
  return (
    <ProtectedRoute adminOnly>
      <ManagementContent />
    </ProtectedRoute>
  );
}
