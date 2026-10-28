/** Create browser-local demo accounts without retaining the collected email. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate } from 'react-router-dom';
import { getUsers, saveUsers } from '../utils/storage.js';
import { setSession } from '../utils/auth.js';

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';
const fields = [
  { name: 'displayName', label: 'Display Name', type: 'text', autoComplete: 'nickname' },
  { name: 'username', label: 'Username', type: 'text', autoComplete: 'username' },
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password' },
  { name: 'confirmPassword', label: 'Confirm Password', type: 'password', autoComplete: 'new-password' },
];

/** Bind a required control to its label and actionable validation message.
 * Args:
 *   name: Form value key and stable control identity.
 *   label: Visible field name.
 *   type: Native input behavior.
 *   autoComplete: Browser autofill purpose.
 *   value: Current entered text.
 *   error: Field-specific validation feedback.
 *   onChange: Controlled input update callback.
 * Returns:
 *   A labeled input and associated error when invalid.
 */
function RegistrationField({ name, label, type, autoComplete, value, error, onChange }) {
  const id = `register-${name}`;
  return (
    <div>
      <label htmlFor={id} className="block font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        aria-required="true"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        value={value}
        onChange={onChange}
        className={`mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 ${focus}`}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

RegistrationField.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  autoComplete: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  error: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};

/** Validate all five fields and persist the account before its session. */
export default function RegisterPage() {
  const [values, setValues] = useState({ displayName: '', username: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  /** Update only the edited field without performing persistence. */
  function change(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  /** Reject invalid input and navigate only after both local writes succeed. */
  function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    for (const { name, label } of fields) {
      if (!values[name].trim()) nextErrors[name] = `${label} is required.`;
    }
    if (!nextErrors.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (!nextErrors.confirmPassword && values.password !== values.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }
    if (values.username === 'admin') nextErrors.username = 'The username admin is reserved.';
    const users = getUsers();
    if (!nextErrors.username && users.some((user) => user.username === values.username)) {
      nextErrors.username = 'This username is already taken.';
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    let account;
    try {
      account = {
        id: crypto.randomUUID(),
        displayName: values.displayName,
        username: values.username,
        password: values.password,
        role: 'user',
        createdAt: new Date().toISOString(),
      };
    } catch {
      setErrors({ form: 'Could not create an account ID. Please use a browser with secure UUID support.' });
      return;
    }
    if (!saveUsers([...users, account])) {
      setErrors({ form: 'Could not save your account. Please check browser storage and try again.' });
      return;
    }
    const session = { userId: account.id, username: account.username, displayName: account.displayName, role: account.role };
    if (!setSession(session)) {
      setErrors({ form: 'Your account was created, but we could not save your session. Check browser storage, then use the Login link below to sign in.' });
      return;
    }
    navigate('/blogs');
  }

  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-[85dvh] items-center justify-center px-4 py-16 sm:px-6">
      <section aria-labelledby="register-heading" className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg">
        <div aria-hidden="true" className="h-1 bg-gradient-to-r from-indigo-600 to-violet-600" />
        <div className="p-8 sm:p-10">
          <img src="/favicon.svg" alt="WriteSpace" width="44" height="44" />
          <p className="mt-6 text-sm font-medium uppercase tracking-widest text-indigo-700">
            Your writing space
          </p>
          <h1 id="register-heading" className="mt-3 font-display text-4xl font-bold tracking-tight">
            Create an account
          </h1>
          <p className="mt-3 text-slate-600">
            Make space for your thoughts with a browser-local account.
          </p>
          <form
            onSubmit={submit}
            noValidate
            aria-describedby={errors.form ? 'register-error' : undefined}
            className="mt-8 space-y-5"
          >
            {fields.map((field) => (
              <RegistrationField
                key={field.name}
                {...field}
                value={values[field.name]}
                error={errors[field.name]}
                onChange={change}
              />
            ))}
            {errors.form && (
              <p id="register-error" role="alert" className="text-sm text-red-700">
                {errors.form}
              </p>
            )}
            <button
              type="submit"
              className={`min-h-11 w-full rounded-full bg-indigo-600 px-4 py-3 font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 motion-reduce:transition-none ${focus}`}
            >
              Create account
            </button>
          </form>
          <p className="mt-6 text-sm text-slate-600">
            Already have an account?{' '}
            <Link to="/login" className={`rounded text-indigo-700 underline underline-offset-4 ${focus}`}>
              Login
            </Link>
          </p>
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            Email is validated for this form only and is not stored.
          </p>
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            Demo only: passwords are stored in plain text and access checks run in your browser. Do not use real passwords or sensitive data.
          </p>
        </div>
      </section>
    </main>
  );
}
