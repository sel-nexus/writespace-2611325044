/** Verify exact account entry, restoration, failure feedback, and shell wiring. */
import { StrictMode } from 'react';
import { it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import LoginPage from './LoginPage.jsx';
import App from '../App.jsx';
import { getSession, setSession } from '../utils/auth.js';
import { saveUsers, getUsers } from '../utils/storage.js';

const future = { v7_startTransition: true, v7_relativeSplatPath: true };
const account = { id: 'u1', displayName: 'Mira', username: 'mira', password: 'demo-only', role: 'user', createdAt: '2026-03-04T12:00:00.000Z' };

/** Show actual navigation without mocking the router. */
function Destination() {
  return <p>Destination {useLocation().pathname}</p>;
}

/** Mount the login page with isolated role destinations. */
function mount() {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={['/login']} future={future}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Destination />} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
}

/** Enter credentials through the labeled controls and submit. */
async function login(user, username, password) {
  if (username) await user.type(screen.getByLabelText('Username'), username);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Login' }));
}

it('shows labeled required controls, demo notice, and register navigation', async () => {
  const user = userEvent.setup();
  mount();
  expect(screen.getByLabelText('Username')).toHaveAttribute('autocomplete', 'username');
  expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  expect(screen.getByLabelText('Password')).toHaveAttribute('aria-required', 'true');
  expect(screen.getByText(/Demo admin:/)).toHaveTextContent('username admin, password admin');
  expect(screen.getByText(/Demo only:/)).toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'Create an account' }));
  expect(screen.getByText('Destination /register')).toBeInTheDocument();
});

it.each([['', '', true, true], ['', 'pass', true, false], ['mira', '', false, true], ['   ', '   ', true, true]])('validates required values %j / %j without writing', async (username, password, missingName, missingPassword) => {
  const user = userEvent.setup();
  const write = vi.spyOn(Storage.prototype, 'setItem');
  mount();
  await login(user, username, password);
  expect(Boolean(screen.queryByText('Username is required.'))).toBe(missingName);
  expect(Boolean(screen.queryByText('Password is required.'))).toBe(missingPassword);
  if (missingName) expect(screen.getByLabelText('Username')).toHaveAttribute('aria-describedby', 'username-error');
  if (missingPassword) expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
  expect(getSession()).toBeNull();
  expect(write).not.toHaveBeenCalled();
});

it('matches built-in admin first even when a conflicting local account exists', async () => {
  saveUsers([{ ...account, username: 'admin', password: 'admin' }]);
  const user = userEvent.setup();
  mount();
  await login(user, 'admin', 'admin');
  expect(screen.getByText('Destination /admin')).toBeInTheDocument();
  expect(getSession()).toEqual({ userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' });
  expect(getUsers()).toEqual([{ ...account, username: 'admin', password: 'admin' }]);
});

it.each(['user', 'admin'])('logs in a local %s and persists only canonical session fields', async (role) => {
  saveUsers([{ ...account, role }]);
  const user = userEvent.setup();
  mount();
  await login(user, 'mira', 'demo-only');
  expect(screen.getByText(`Destination ${role === 'admin' ? '/admin' : '/blogs'}`)).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual({ userId: 'u1', username: 'mira', displayName: 'Mira', role });
  expect(getSession()).toEqual({ userId: 'u1', username: 'mira', displayName: 'Mira', role });
  expect(getUsers()).toEqual([{ ...account, role }]);
});

it.each([['Mira', 'demo-only'], ['mira ', 'demo-only'], ['mira', 'demo-only '], ['mira', 'wrong'], ['unknown', 'demo-only']])('rejects nonexact credentials %j / %j', async (username, password) => {
  saveUsers([account]);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const user = userEvent.setup();
  mount();
  await login(user, username, password);
  expect(screen.getByRole('alert')).toHaveTextContent('Invalid username or password.');
  expect(screen.getByLabelText('Password')).toHaveAttribute('aria-describedby', 'login-error');
  expect(getSession()).toBeNull();
  expect(write).not.toHaveBeenCalled();
});

it.each(['{broken', '[]', '{}'])('leaves unusable user bytes untouched after rejected login', async (bytes) => {
  localStorage.setItem('writespace_users', bytes);
  const user = userEvent.setup();
  mount();
  await login(user, 'mira', 'demo-only');
  expect(screen.getByRole('alert')).toHaveTextContent('Invalid username or password.');
  expect(localStorage.getItem('writespace_users')).toBe(bytes);
  expect(getSession()).toBeNull();
});

it('can authenticate built-in admin when user reads are unavailable', async () => {
  const original = Storage.prototype.getItem;
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function read(key) {
    if (key === 'writespace_users') throw new Error('Unavailable');
    return original.call(this, key);
  });
  const user = userEvent.setup();
  mount();
  await login(user, 'admin', 'admin');
  expect(getSession()?.role).toBe('admin');
  expect(screen.getByText('Destination /admin')).toBeInTheDocument();
});

it('rejects local login when user reads throw without creating identity', async () => {
  saveUsers([account]);
  const original = Storage.prototype.getItem;
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function read(key) {
    if (key === 'writespace_users') throw new Error('Unavailable');
    return original.call(this, key);
  });
  const user = userEvent.setup();
  mount();
  await login(user, 'mira', 'demo-only');
  expect(screen.getByRole('alert')).toHaveTextContent('Invalid username or password.');
  expect(getSession()).toBeNull();
});

it('keeps built-in admin on login when session persistence fails', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked'); });
  const user = userEvent.setup();
  mount();
  await login(user, 'admin', 'admin');
  expect(screen.getByRole('alert')).toHaveTextContent('Could not save your session.');
  expect(screen.queryByText(/Destination/)).not.toBeInTheDocument();
  expect(getSession()).toBeNull();
});

it.each(['user', 'admin'])('retains form and does not navigate when %s session write fails', async (role) => {
  saveUsers([{ ...account, role }]);
  localStorage.setItem('writespace_session', '{broken');
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
  const user = userEvent.setup();
  mount();
  await login(user, 'mira', 'demo-only');
  expect(screen.getByRole('alert')).toHaveTextContent('Could not save your session.');
  expect(screen.getByLabelText('Username')).toHaveValue('mira');
  expect(screen.getByLabelText('Password')).toHaveValue('demo-only');
  expect(screen.queryByText(/Destination/)).not.toBeInTheDocument();
  expect(localStorage.getItem('writespace_session')).toBe('{broken');
  expect(getSession()).toBeNull();
  write.mockRestore();
});

it.each(['user', 'admin'])('restores a %s session and redirects without mutations', (role) => {
  const session = { userId: 'u1', username: 'mira', displayName: 'Mira', role };
  setSession(session);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  mount();
  expect(screen.getByText(`Destination ${role === 'admin' ? '/admin' : '/blogs'}`)).toBeInTheDocument();
  expect(getSession()).toEqual(session);
  expect(write).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});

it('keeps render and rerender pure and refreshes errors on resubmit', async () => {
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  const user = userEvent.setup();
  const view = mount();
  view.rerender(
    <StrictMode>
      <MemoryRouter initialEntries={['/login']} future={future}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Destination />} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
  expect(write).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  await login(user, 'bad', 'bad');
  expect(screen.getByRole('alert')).toHaveTextContent('Invalid username or password.');
  await user.clear(screen.getByLabelText('Username'));
  await user.clear(screen.getByLabelText('Password'));
  await login(user, 'admin', 'admin');
  expect(screen.getByText('Destination /admin')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('wires public login, session navbar, unfinished destination, and logout at root', async () => {
  const user = userEvent.setup();
  render(
    <StrictMode>
      <MemoryRouter future={future}>
        <App />
      </MemoryRouter>
    </StrictMode>,
  );
  expect(screen.getByRole('navigation', { name: 'Public navigation' })).toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'Login' }));
  await login(user, 'admin', 'admin');
  expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Account navigation' })).toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'WriteSpace' }));
  await user.click(screen.getByRole('button', { name: 'Admin account' }));
  await user.click(screen.getByRole('button', { name: 'Logout' }));
  expect(getSession()).toBeNull();
  expect(screen.getByRole('navigation', { name: 'Public navigation' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
});
