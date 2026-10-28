/** Exercise registration validation and real storage transitions through the UI. */
import { StrictMode } from 'react';
import { it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import RegisterPage from './RegisterPage.jsx';
import App from '../App.jsx';
import { getUsers, saveUsers } from '../utils/storage.js';
import { getSession, setSession } from '../utils/auth.js';

const future = { v7_startTransition: true, v7_relativeSplatPath: true };
const valid = { 'Display Name': 'Mira Writer', Username: 'mira', Email: 'mira@example.test', Password: 'demo-only', 'Confirm Password': 'demo-only' };
const existing = { id: 'u1', displayName: 'Existing', username: 'existing', password: 'existing-demo', role: 'user', createdAt: '2026-03-04T12:00:00.000Z' };

/** Expose the router destination without replacing navigation with a mock. */
function Destination() {
  return (
    <p>Destination {useLocation().pathname}</p>
  );
}

/** Compose a strict-mode registration route with observable destinations. */
function tree() {
  return (
    <StrictMode>
      <MemoryRouter initialEntries={['/register']} future={future}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="*" element={<Destination />} />
        </Routes>
      </MemoryRouter>
    </StrictMode>
  );
}

/** Fill the labeled controls with specified inputs and submit deliberately. */
async function register(user, overrides = {}) {
  for (const [label, value] of Object.entries({ ...valid, ...overrides })) {
    if (value) await user.type(screen.getByLabelText(label, { exact: true }), value);
  }
  await user.click(screen.getByRole('button', { name: 'Create account' }));
}

/** Assert that rejected submission leaves all existing persistent bytes intact. */
function expectUnchanged() {
  expect(getUsers()).toEqual([existing]);
  expect(JSON.parse(localStorage.getItem('writespace_users'))).toEqual([existing]);
  expect(localStorage.getItem('writespace_session')).toBeNull();
  expect(getSession()).toBeNull();
  expect(screen.queryByText(/Destination/)).not.toBeInTheDocument();
}

it('binds all five required controls and provides truthful notices and login navigation', async () => {
  const user = userEvent.setup();
  render(tree());
  for (const label of Object.keys(valid)) {
    const input = screen.getByLabelText(label, { exact: true });
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(input).toHaveAttribute('aria-invalid', 'false');
  }
  expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
  expect(screen.getByLabelText('Password', { exact: true })).toHaveAttribute('type', 'password');
  expect(screen.getByLabelText('Confirm Password')).toHaveAttribute('autocomplete', 'new-password');
  expect(screen.getByText(/Email is validated/)).toHaveTextContent('not stored');
  expect(screen.getByText(/Demo only:/)).toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'Login' }));
  expect(screen.getByText('Destination /login')).toBeInTheDocument();
});

it.each(Object.keys(valid).flatMap((label) => [[label, ''], [label, '   ']]))('rejects missing or blank %s (%j) without writes', async (label, value) => {
  saveUsers([existing]);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const user = userEvent.setup();
  render(tree());
  await register(user, { [label]: value });
  expect(screen.getByText(`${label} is required.`)).toBeInTheDocument();
  const input = screen.getByLabelText(label, { exact: true });
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(document.getElementById(input.getAttribute('aria-describedby'))).toHaveTextContent(`${label} is required.`);
  expect(write).not.toHaveBeenCalled();
  expectUnchanged();
});

it('reports all required errors together for an empty submission', async () => {
  const user = userEvent.setup();
  render(tree());
  await user.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getAllByRole('alert')).toHaveLength(5);
  expect(localStorage.getItem('writespace_users')).toBeNull();
  expect(getSession()).toBeNull();
});

it.each(['not-an-email', 'mira@', '@example.test', 'mira@example', 'mira name@example.test', 'mira@@example.test'])('rejects invalid email syntax %j', async (email) => {
  saveUsers([existing]);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const user = userEvent.setup();
  render(tree());
  await register(user, { Email: email });
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
  expect(screen.getByLabelText('Email')).toHaveAttribute('aria-describedby', 'register-email-error');
  expect(write).not.toHaveBeenCalled();
  expectUnchanged();
});

it('rejects mismatched passwords and preserves entered values', async () => {
  saveUsers([existing]);
  const user = userEvent.setup();
  render(tree());
  await register(user, { 'Confirm Password': 'different' });
  expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match.');
  expect(screen.getByLabelText('Confirm Password')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText('Password', { exact: true })).toHaveValue('demo-only');
  expectUnchanged();
});

it.each([['admin', 'The username admin is reserved.'], ['existing', 'This username is already taken.']])('rejects reserved or exact duplicate username %s', async (username, message) => {
  saveUsers([existing]);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const user = userEvent.setup();
  render(tree());
  await register(user, { Username: username });
  expect(screen.getByRole('alert')).toHaveTextContent(message);
  expect(screen.getByLabelText('Username')).toHaveAttribute('aria-describedby', 'register-username-error');
  expect(write).not.toHaveBeenCalled();
  expectUnchanged();
});

it.each(['mira', 'Existing', 'existing ', 'Admin'])('persists canonical UUID account and session for exact distinct username %j', async (username) => {
  saveUsers([existing]);
  localStorage.setItem('writespace_posts', '["untouched"]');
  const before = Date.now();
  const user = userEvent.setup();
  render(tree());
  await register(user, { Username: username, Password: ' demo-only ', 'Confirm Password': ' demo-only ' });
  const stored = JSON.parse(localStorage.getItem('writespace_users'));
  const account = stored[1];
  expect(stored[0]).toEqual(existing);
  expect(stored).toHaveLength(2);
  expect(account).toEqual({ id: expect.any(String), displayName: 'Mira Writer', username, password: ' demo-only ', role: 'user', createdAt: expect.any(String) });
  expect(account.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  expect(new Date(account.createdAt).toISOString()).toBe(account.createdAt);
  expect(Date.parse(account.createdAt)).toBeGreaterThanOrEqual(before);
  expect(Date.parse(account.createdAt)).toBeLessThanOrEqual(Date.now());
  expect(getUsers()).toEqual(stored);
  const session = { userId: account.id, username, displayName: 'Mira Writer', role: 'user' };
  expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual(session);
  expect(getSession()).toEqual(session);
  expect(localStorage.getItem('writespace_posts')).toBe('["untouched"]');
  expect(screen.getByText('Destination /blogs')).toBeInTheDocument();
});

it('reads usernames again at submit rather than using a stale mounted collection', async () => {
  const user = userEvent.setup();
  render(tree());
  saveUsers([{ ...existing, username: 'mira' }]);
  await register(user);
  expect(screen.getByRole('alert')).toHaveTextContent('This username is already taken.');
  expect(getUsers()).toEqual([{ ...existing, username: 'mira' }]);
  expect(getSession()).toBeNull();
});

it('leaves collection and session intact when the account write throws', async () => {
  saveUsers([existing]);
  const session = { userId: 'u1', username: 'existing', displayName: 'Existing', role: 'user' };
  setSession(session);
  const original = Storage.prototype.setItem;
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function persist(key, value) {
    if (key === 'writespace_users') throw new Error('Quota');
    return original.call(this, key, value);
  });
  const user = userEvent.setup();
  render(tree());
  await register(user);
  expect(screen.getByRole('alert')).toHaveTextContent('Could not save your account.');
  expect(getUsers()).toEqual([existing]);
  expect(JSON.parse(localStorage.getItem('writespace_users'))).toEqual([existing]);
  expect(getSession()).toEqual(session);
  expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual(session);
  expect(write.mock.calls.map(([key]) => key)).toEqual(['writespace_users']);
  expect(screen.getByLabelText('Username')).toHaveValue('mira');
  expect(screen.queryByText(/Destination/)).not.toBeInTheDocument();
});

it('retains the created account but explains login when session persistence throws', async () => {
  saveUsers([existing]);
  localStorage.setItem('writespace_session', '{broken');
  const original = Storage.prototype.setItem;
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function persist(key, value) {
    if (key === 'writespace_session') throw new Error('Blocked');
    return original.call(this, key, value);
  });
  const user = userEvent.setup();
  render(tree());
  await register(user);
  expect(screen.getByRole('alert')).toHaveTextContent('Your account was created, but we could not save your session.');
  expect(screen.getByRole('alert')).toHaveTextContent('Login link below');
  expect(getUsers()).toEqual(JSON.parse(localStorage.getItem('writespace_users')));
  expect(getUsers()).toHaveLength(2);
  expect(getUsers()[1]).toMatchObject({ username: 'mira', role: 'user' });
  expect(getUsers()[1]).not.toHaveProperty('email');
  expect(localStorage.getItem('writespace_session')).toBe('{broken');
  expect(getSession()).toBeNull();
  expect(write.mock.calls.map(([key]) => key)).toEqual(['writespace_users', 'writespace_session']);
  expect(screen.queryByText(/Destination/)).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByRole('alert')).toHaveTextContent('This username is already taken.');
  expect(getUsers()).toHaveLength(2);
  await user.click(screen.getByRole('link', { name: 'Login' }));
  expect(screen.getByText('Destination /login')).toBeInTheDocument();
});

it('surfaces UUID creation failure without any persistent mutation', async () => {
  saveUsers([existing]);
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('Unavailable'); });
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const user = userEvent.setup();
  render(tree());
  await register(user);
  expect(screen.getByRole('alert')).toHaveTextContent('Could not create an account ID.');
  expect(write).not.toHaveBeenCalled();
  expectUnchanged();
});

it('keeps strict-mode mounting, rerendering, and typing free of storage mutations', async () => {
  localStorage.setItem('writespace_users', '{broken');
  localStorage.setItem('writespace_session', '{broken');
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  const clear = vi.spyOn(Storage.prototype, 'clear');
  const uuid = vi.spyOn(crypto, 'randomUUID');
  const user = userEvent.setup();
  const view = render(tree());
  view.rerender(tree());
  await user.type(screen.getByLabelText('Display Name'), 'Mira');
  expect(write).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  expect(clear).not.toHaveBeenCalled();
  expect(uuid).not.toHaveBeenCalled();
  expect(localStorage.getItem('writespace_users')).toBe('{broken');
  expect(localStorage.getItem('writespace_session')).toBe('{broken');
});

it('refreshes validation on a corrected submit and creates exactly one account', async () => {
  const user = userEvent.setup();
  render(tree());
  await register(user, { 'Confirm Password': 'wrong' });
  expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match.');
  await user.clear(screen.getByLabelText('Confirm Password'));
  await user.type(screen.getByLabelText('Confirm Password'), 'demo-only');
  await user.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText('Destination /blogs')).toBeInTheDocument();
  expect(getUsers()).toHaveLength(1);
  expect(getSession()?.userId).toBe(getUsers()[0].id);
});

it('wires register into the existing public shell and refreshes navigation after account entry', async () => {
  const user = userEvent.setup();
  render(
    <StrictMode>
      <MemoryRouter initialEntries={['/login']} future={future}>
        <App />
      </MemoryRouter>
    </StrictMode>,
  );
  await user.click(screen.getByRole('link', { name: 'Create an account' }));
  expect(screen.getByRole('heading', { name: 'Create an account' })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Public navigation' })).toBeInTheDocument();
  await register(user);
  expect(screen.getByRole('navigation', { name: 'Account navigation' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Mira Writer account' })).toBeInTheDocument();
  expect(getSession()?.userId).toBe(getUsers()[0].id);
});
