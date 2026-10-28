/** Verify admin-only activity, real navigation and persistence-first post deletion. */
import { StrictMode } from 'react';
import { expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminDashboard from './AdminDashboard.jsx';
import App from '../App.jsx';
import { getPosts, savePosts, saveUsers } from '../utils/storage.js';
import { setSession } from '../utils/auth.js';

const future = { v7_startTransition: true, v7_relativeSplatPath: true };
const admin = { userId: 'extra-admin', username: 'editor', displayName: 'Editor', role: 'admin' };
const user = { ...admin, role: 'user' };
const post = {
  id: 'p1', title: 'A note', content: 'Plain text', authorId: 'writer', authorName: 'Writer',
  createdAt: '2026-03-01T00:00:00.000Z',
};
const collection = [1, 7, 3, 2, 6, 4, 5].map((day) => ({
  ...post, id: `p${day}`, title: `Note ${day}`, createdAt: `2026-03-0${day}T00:00:00.000Z`,
}));

/** Mount either the isolated page or the actual app route in StrictMode. */
function mount(app = false) {
  const element = (
    <StrictMode>
      <MemoryRouter initialEntries={['/admin']} future={future}>
        {app ? <App /> : (
          <Routes>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/login" element={<p>Login destination</p>} />
            <Route path="/blogs" element={<p>Blogs destination</p>} />
            <Route path="/write" element={<p>Write destination</p>} />
            <Route path="/users" element={<p>Users destination</p>} />
            <Route path="/blog/:id" element={<p>Read destination</p>} />
            <Route path="/edit/:id" element={<p>Edit destination</p>} />
          </Routes>
        )}
      </MemoryRouter>
    </StrictMode>
  );
  return { ...render(element), element };
}

it.each([null, user])('redirects guests/users without exposing dashboard controls', (principal) => {
  if (principal) setSession(principal);
  savePosts([post]);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  mount();
  expect(screen.getByText(principal ? 'Blogs destination' : 'Login destination')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Manage users' })).not.toBeInTheDocument();
  expect(write).not.toHaveBeenCalled();
});

it.each([null, user, admin])('composes the actual adminOnly route for each session role', (principal) => {
  if (principal) setSession(principal);
  mount(true);
  const heading = principal?.role === 'admin' ? 'Admin dashboard' : principal ? 'Blogs' : 'Welcome back';
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading);
  expect(screen.queryByRole('link', { name: 'Manage users' }) !== null).toBe(principal?.role === 'admin');
});

it('shows only the newest five with dates, any-post controls and no invented metrics', () => {
  setSession(admin);
  savePosts(collection);
  const raw = localStorage.getItem('writespace_posts');
  mount();
  expect(screen.getAllByRole('article').map((article) => within(article).getByRole('heading').textContent))
    .toEqual(['Note 7', 'Note 6', 'Note 5', 'Note 4', 'Note 3']);
  expect(screen.getAllByRole('button', { name: /^Delete / })).toHaveLength(5);
  expect(screen.getAllByRole('link', { name: /^Edit / })).toHaveLength(5);
  expect(screen.queryByRole('heading', { name: 'Note 2' })).not.toBeInTheDocument();
  expect(screen.getByText('Mar 07, 2026')).toHaveAttribute('datetime', collection[1].createdAt);
  expect(screen.getByText('Recent local activity').closest('dl')).toHaveTextContent('Note 7');
  expect(screen.queryByText(/Total Users|Total Admins|Total Posts/)).not.toBeInTheDocument();
  expect(document.querySelector('svg, canvas')).toBeNull();
  expect(localStorage.getItem('writespace_posts')).toBe(raw);
});

it.each([
  ['Write', '/write', 'Write destination'],
  ['Manage users', '/users', 'Users destination'],
  ['Read A note', '/blog/a%2Fb', 'Read destination'],
  ['Edit A note', '/edit/a%2Fb', 'Edit destination'],
])('follows the real %s navigation link without writing posts', async (label, href, destination) => {
  setSession(admin);
  const saved = { ...post, id: 'a/b' };
  savePosts([saved]);
  mount();
  const link = screen.getByRole('link', { name: label, exact: true });
  expect(link).toHaveAttribute('href', href);
  await userEvent.setup().click(link);
  expect(screen.getByText(destination)).toBeInTheDocument();
  expect(getPosts()).toEqual([saved]);
});

it.each([null, '[]', '{', '[{"id":"broken"}]'])('renders empty activity without repairing storage %s', (raw) => {
  setSession(admin);
  if (raw !== null) localStorage.setItem('writespace_posts', raw);
  mount();
  expect(screen.getByText('No posts yet')).toBeInTheDocument();
  expect(screen.getByText('No posts yet. Select Write to create a local post.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
  expect(localStorage.getItem('writespace_posts')).toBe(raw);
});

it('renders an empty activity fallback when post storage reads throw without attempting repair', () => {
  setSession(admin);
  const read = Storage.prototype.getItem;
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function getItem(key) {
    if (key === 'writespace_posts') throw new Error('unavailable');
    return read.call(this, key);
  });
  const write = vi.spyOn(Storage.prototype, 'setItem');
  mount();
  expect(screen.getByText('No posts yet')).toBeInTheDocument();
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
  expect(write).not.toHaveBeenCalled();
});

it('does not write or remove data on StrictMode mount and rerender', () => {
  setSession(admin);
  savePosts([post]);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  const view = mount();
  view.rerender(view.element);
  expect(write).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  expect(getPosts()).toEqual([post]);
});

it('cancels confirmation without a write, route change or list update', async () => {
  setSession(admin);
  savePosts(collection);
  mount();
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  await userEvent.setup().click(screen.getByRole('button', { name: 'Delete Note 7' }));
  expect(write).not.toHaveBeenCalled();
  expect(getPosts()).toEqual(collection);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Admin dashboard');
  expect(screen.getByRole('article', { name: 'Note 7' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
});

it('deletes any author post, preserves fresh unrelated data and refills the recent five', async () => {
  setSession(admin);
  savePosts(collection);
  saveUsers([{ id: 'writer', displayName: 'Writer', username: 'writer', password: 'demo',
    role: 'user', createdAt: post.createdAt }]);
  const users = localStorage.getItem('writespace_users');
  const session = localStorage.getItem('writespace_session');
  mount();
  const added = { ...post, id: 'another-tab', title: 'Another tab note' };
  savePosts([...collection, added]);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Delete Note 7' }));
  expect(confirm).toHaveBeenCalledWith('Delete this post? This cannot be undone.');
  expect(getPosts()).toEqual([...collection.filter((record) => record.id !== 'p7'), added]);
  expect(screen.getAllByRole('article').map((article) => article.getAttribute('aria-label')))
    .toEqual(['Note 6', 'Note 5', 'Note 4', 'Note 3', 'Note 2']);
  expect(screen.getByText('Recent local activity').closest('dl')).toHaveTextContent('Note 6');
  expect(screen.getByRole('status')).toHaveTextContent('Post deleted.');
  expect(localStorage.getItem('writespace_users')).toBe(users);
  expect(localStorage.getItem('writespace_session')).toBe(session);
});

it('updates the empty state after successful last-post deletion', async () => {
  setSession(admin);
  savePosts([post]);
  mount();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Delete A note' }));
  expect(getPosts()).toEqual([]);
  expect(screen.getByText('No posts yet')).toBeInTheDocument();
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
});

it('retains the list and actionable error after write failure and later confirmation cancellation', async () => {
  setSession(admin);
  savePosts([post]);
  mount();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  const actor = userEvent.setup();
  await actor.click(screen.getByRole('button', { name: 'Delete A note' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Could not delete this post. Check browser storage');
  expect(getPosts()).toEqual([post]);
  expect(screen.getByRole('article', { name: 'A note' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  confirm.mockReturnValue(false);
  await actor.click(screen.getByRole('button', { name: 'Delete A note' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Could not delete this post');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Admin dashboard');
});

it.each(['guest', 'user', 'demoted-owner', 'guest-during-confirm', 'demoted-during-confirm'])(
  'denies stale permission %s even when the new user owns the post', async (change) => {
    setSession(admin);
    const owned = { ...post, authorId: admin.userId };
    savePosts([owned]);
    mount();
    if (change === 'guest') localStorage.removeItem('writespace_session');
    if (change === 'user') setSession({ ...user, userId: 'other' });
    if (change === 'demoted-owner') setSession(user);
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      if (change === 'guest-during-confirm') localStorage.removeItem('writespace_session');
      if (change === 'demoted-during-confirm') setSession(user);
      return true;
    });
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete A note' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Admin access is required');
    expect(screen.getByRole('article', { name: 'A note' })).toBeInTheDocument();
    expect(getPosts()).toEqual([owned]);
    expect(writes.mock.calls.filter(([key]) => key === 'writespace_posts')).toEqual([]);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Admin dashboard');
  },
);

it('reports a missing fresh target without replacing the displayed list or writing', async () => {
  setSession(admin);
  savePosts([post]);
  mount();
  savePosts([]);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  await userEvent.setup().click(screen.getByRole('button', { name: 'Delete A note' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Post not found');
  expect(screen.getByRole('article', { name: 'A note' })).toBeInTheDocument();
  expect(write).not.toHaveBeenCalled();
  expect(getPosts()).toEqual([]);
});
