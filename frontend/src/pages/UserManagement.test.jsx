/** Exercise guarded account administration with real localStorage and StrictMode. */
import { StrictMode } from 'react';
import { expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import UserManagement from './UserManagement.jsx';
import App from '../App.jsx';
import { getUsers, saveUsers, savePosts } from '../utils/storage.js';
import { setSession } from '../utils/auth.js';

const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
const account = { id: 'writer', displayName: 'Writer', username: 'writer', password: 'hidden-secret', role: 'user', createdAt: '2026-03-01T00:00:00.000Z' };
const post = { id: 'p1', title: 'Keep', content: 'Body', authorId: account.id, authorName: 'Writer', createdAt: account.createdAt };

/** Mount isolated and real route compositions in development-safe StrictMode. */
function mount(app = false) {
  const element = (
    <StrictMode>
      <MemoryRouter initialEntries={['/users']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {app ? <App /> : (
          <Routes>
            <Route path="/users" element={<UserManagement />} />
            <Route path="/login" element={<p>Login destination</p>} />
            <Route path="/blogs" element={<p>Blogs destination</p>} />
          </Routes>
        )}
      </MemoryRouter>
    </StrictMode>
  );
  return { ...render(element), element };
}

/** Fill the labeled creation form without changing persistent state. */
async function fill(actor, role = 'user', username = 'new-writer') {
  await actor.type(screen.getByLabelText('Display Name'), 'New Writer');
  await actor.type(screen.getByLabelText('Username'), username);
  await actor.type(screen.getByLabelText('Password'), 'demo-only');
  await actor.selectOptions(screen.getByLabelText('Role'), role);
}

it.each([null, { ...admin, role: 'user' }, admin])('guards the actual /users route for each role', (session) => {
  if (session) setSession(session);
  mount(true);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(session?.role === 'admin' ? 'User management' : session ? 'Blogs' : 'Welcome back');
  expect(screen.queryByRole('button', { name: 'Create account' }) !== null).toBe(session?.role === 'admin');
});

it.each([null, { ...admin, role: 'user' }])('guards direct page usage without writes', (session) => {
  if (session) setSession(session);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  mount();
  expect(screen.getByText(session ? 'Blogs destination' : 'Login destination')).toBeInTheDocument();
  expect(write).not.toHaveBeenCalled();
});

it('shows protected logical admin and local roles, omits passwords, and never mutates during StrictMode render', () => {
  setSession({ ...admin, userId: 'editor', username: 'editor' });
  saveUsers([account, { ...account, id: 'editor', username: 'editor', role: 'admin' }]);
  savePosts([post]);
  const raw = localStorage.getItem('writespace_users');
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  const view = mount();
  view.rerender(view.element);
  expect(screen.getByRole('table')).toHaveAccessibleName('Demo accounts, roles and eligible deletion actions');
  expect(screen.getAllByRole('columnheader')).toHaveLength(5);
  expect(screen.getByText('Protected')).toBeInTheDocument();
  expect(screen.getByText('Current account')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Delete admin' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Delete editor' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Delete writer' })).toBeInTheDocument();
  expect(screen.getByText(/Demo only: passwords are stored in plain text/)).toBeInTheDocument();
  expect(view.container.textContent).not.toContain(account.password);
  expect(write).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  expect(localStorage.getItem('writespace_users')).toBe(raw);
});

it.each([null, '[]', '{', '[{"id":"broken"}]'])('renders empty local accounts without repairing %s', (raw) => {
  setSession(admin);
  if (raw !== null) localStorage.setItem('writespace_users', raw);
  mount();
  expect(screen.getByText(/No local accounts yet/)).toBeInTheDocument();
  expect(screen.getByText('Built-in account')).toBeInTheDocument();
  expect(localStorage.getItem('writespace_users')).toBe(raw);
});

it('associates every required-field error with its input and retains entered values', async () => {
  setSession(admin);
  mount();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Create account' }));
  for (const label of ['Display Name', 'Username', 'Password', 'Role']) {
    const input = screen.getByLabelText(label);
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById(input.getAttribute('aria-describedby'))).toHaveAttribute('role', 'alert');
  }
  expect(screen.getAllByRole('alert')).toHaveLength(4);
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  expect(localStorage.getItem('writespace_users')).toBeNull();
});

it.each(['admin', 'writer'])('shows reserved/duplicate username error without resetting form or writing', async (username) => {
  setSession(admin);
  saveUsers([account]);
  mount();
  const actor = userEvent.setup();
  await fill(actor, 'user', username);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  await actor.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByRole('alert')).toHaveTextContent(username === 'admin' ? 'reserved' : 'already in use');
  expect(screen.getByLabelText('Username')).toHaveValue(username);
  expect(screen.getByLabelText('Password')).toHaveValue('demo-only');
  expect(write).not.toHaveBeenCalled();
  expect(getUsers()).toEqual([account]);
});

it.each(['user', 'admin'])('creates %s with fresh collection/UUID fields and resets only on success', async (role) => {
  setSession(admin);
  savePosts([post]);
  mount();
  saveUsers([account]);
  const actor = userEvent.setup();
  await fill(actor, role);
  const posts = localStorage.getItem('writespace_posts');
  const session = localStorage.getItem('writespace_session');
  await actor.click(screen.getByRole('button', { name: 'Create account' }));
  const created = getUsers()[1];
  expect(created).toEqual({ id: expect.any(String), displayName: 'New Writer', username: 'new-writer', password: 'demo-only', role, createdAt: expect.any(String) });
  expect(created.id).toMatch(/^[0-9a-f-]{36}$/i);
  expect(new Date(created.createdAt).toISOString()).toBe(created.createdAt);
  expect(getUsers()[0]).toEqual(account);
  expect(screen.getByRole('status')).toHaveTextContent('Account created for new-writer.');
  expect(screen.getByText('@new-writer')).toBeInTheDocument();
  for (const label of ['Display Name', 'Username', 'Password', 'Role']) expect(screen.getByLabelText(label)).toHaveValue('');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(localStorage.getItem('writespace_posts')).toBe(posts);
  expect(localStorage.getItem('writespace_session')).toBe(session);
});

it('retains form/list and shows actionable failure when creation cannot be saved', async () => {
  setSession(admin);
  saveUsers([account]);
  mount();
  const actor = userEvent.setup();
  await fill(actor);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  await actor.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Could not create this account');
  expect(screen.getByLabelText('Display Name')).toHaveValue('New Writer');
  expect(screen.getByLabelText('Password')).toHaveValue('demo-only');
  expect(screen.getByLabelText('Role')).toHaveValue('user');
  expect(screen.queryByText('@new-writer')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  expect(getUsers()).toEqual([account]);
});

it.each(['guest', 'nonadmin'])('denies creation when the fresh session is %s', async (state) => {
  setSession(admin);
  mount();
  const actor = userEvent.setup();
  await fill(actor);
  if (state === 'guest') localStorage.removeItem('writespace_session');
  else setSession({ ...admin, role: 'user' });
  await actor.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByRole('alert')).toHaveTextContent(state === 'guest' ? 'session ended' : 'Admin access is required');
  expect(screen.getByLabelText('Username')).toHaveValue('new-writer');
  expect(getUsers()).toEqual([]);
});

it('cancels deletion without mutation or route change', async () => {
  setSession(admin);
  saveUsers([account]);
  mount();
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  await userEvent.setup().click(screen.getByRole('button', { name: 'Delete writer' }));
  expect(getUsers()).toEqual([account]);
  expect(write).not.toHaveBeenCalled();
  expect(screen.getByText('@writer')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('User management');
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
});

it('deletes only the confirmed target, rereads other users and leaves posts/session unchanged', async () => {
  setSession(admin);
  saveUsers([account]);
  savePosts([post]);
  mount();
  const added = { ...account, id: 'other', username: 'other', role: 'admin' };
  saveUsers([account, added]);
  const posts = localStorage.getItem('writespace_posts');
  const session = localStorage.getItem('writespace_session');
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Delete writer' }));
  expect(confirm).toHaveBeenCalledWith('Delete this account? This cannot be undone. Posts will not be changed.');
  expect(getUsers()).toEqual([added]);
  expect(screen.queryByText('@writer')).not.toBeInTheDocument();
  expect(screen.getByText('@other')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Account deleted. Posts were not changed.');
  expect(localStorage.getItem('writespace_posts')).toBe(posts);
  expect(localStorage.getItem('writespace_session')).toBe(session);
});

it('updates empty state after last local account deletion', async () => {
  setSession(admin);
  saveUsers([account]);
  mount();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Delete writer' }));
  expect(getUsers()).toEqual([]);
  expect(screen.getByText(/No local accounts yet/)).toBeInTheDocument();
  expect(screen.getByText('Protected')).toBeInTheDocument();
});

it('retains target on failed deletion and does not clear failure when a later confirmation is cancelled', async () => {
  setSession(admin);
  saveUsers([account]);
  mount();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  const actor = userEvent.setup();
  await actor.click(screen.getByRole('button', { name: 'Delete writer' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Could not delete this account');
  expect(getUsers()).toEqual([account]);
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  confirm.mockReturnValue(false);
  await actor.click(screen.getByRole('button', { name: 'Delete writer' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Could not delete this account');
  expect(screen.getByText('@writer')).toBeInTheDocument();
});

it.each(['guest', 'nonadmin', 'guest-in-confirm', 'nonadmin-in-confirm', 'self', 'self-in-confirm', 'missing'])(
  'rechecks fresh deletion policy for %s without replacing list or posts', async (state) => {
    setSession(admin);
    saveUsers([account]);
    savePosts([post]);
    mount();
    if (state === 'guest') localStorage.removeItem('writespace_session');
    if (state === 'nonadmin') setSession({ ...admin, role: 'user' });
    if (state === 'self') setSession({ ...admin, userId: account.id });
    if (state === 'missing') saveUsers([]);
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      if (state === 'guest-in-confirm') localStorage.removeItem('writespace_session');
      if (state === 'nonadmin-in-confirm') setSession({ ...admin, role: 'user' });
      if (state === 'self-in-confirm') setSession({ ...admin, userId: account.id });
      return true;
    });
    const posts = localStorage.getItem('writespace_posts');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete writer' }));
    expect(screen.getByRole('alert')).toHaveTextContent(state === 'missing' ? 'Account not found' : state.startsWith('self') ? 'current account' : state === 'guest-in-confirm' ? 'session ended' : 'Admin access is required');
    expect(screen.getByText('@writer')).toBeInTheDocument();
    expect(write.mock.calls.filter(([key]) => key === 'writespace_users')).toEqual([]);
    expect(localStorage.getItem('writespace_posts')).toBe(posts);
    expect(getUsers()).toEqual(state === 'missing' ? [] : [account]);
  },
);

it('clears required field errors after successful correction without exposing password in the table', async () => {
  setSession(admin);
  mount();
  const actor = userEvent.setup();
  await actor.click(screen.getByRole('button', { name: 'Create account' }));
  await fill(actor);
  await actor.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(within(screen.getByRole('table')).queryByText('demo-only')).not.toBeInTheDocument();
});
