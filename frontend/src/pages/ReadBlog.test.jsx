/** Verify safe full-text reading, missing records, permissions and render purity. */
import { StrictMode } from 'react';
import { it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ReadBlog from './ReadBlog.jsx';
import App from '../App.jsx';
import { getPosts, savePosts } from '../utils/storage.js';
import { setSession } from '../utils/auth.js';

const future = { v7_startTransition: true, v7_relativeSplatPath: true };
const session = { userId: 'u1', username: 'mira', displayName: 'Mira', role: 'user' };
const post = { id: 'p1', title: 'A note', content: 'First line\n\n  Indented line\n<script>alert(1)</script>\n<img src=x onerror=alert(1)>', authorId: 'u1', authorName: 'Mira', createdAt: '2026-03-04T00:00:00.000Z' };

/** Mount the reader with a matching parameter or a deliberately parameterless route. */
function mount(path = '/blog/p1', element = <ReadBlog />) {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]} future={future}>
        <Routes>
          <Route path="/blog/:id" element={element} />
          <Route path="/reader" element={element} />
          <Route path="/blogs" element={<p>List destination</p>} />
          <Route path="/edit/:id" element={<p>Edit destination</p>} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
}

it('renders the complete body as text, retains exact whitespace, date and author, with no injected elements', () => {
  savePosts([post]);
  setSession(session);
  mount();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(post.title);
  expect(screen.getByText('By Mira')).toBeInTheDocument();
  expect(screen.getByText('Mar 04, 2026')).toHaveAttribute('datetime', post.createdAt);
  const body = screen.getByRole('article').querySelector('.whitespace-pre-wrap');
  expect(body.textContent).toBe(post.content);
  expect(body).toHaveClass('break-words');
  expect(screen.getByRole('article').querySelector('script, img')).toBeNull();
  expect(screen.getByRole('button', { name: 'Delete post' })).toBeInTheDocument();
});
it.each(['/blog/missing', '/reader'])('shows exact not-found and a working back link for %s', async (path) => {
  savePosts([post]);
  setSession(session);
  mount(path);
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Post not found');
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Edit post' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Delete post' })).not.toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('link', { name: 'Back to blogs' }));
  expect(screen.getByText('List destination')).toBeInTheDocument();
});
it.each([null, { ...session, userId: 'other' }])('does not expose Edit to guests or non-owners', (principal) => {
  savePosts([post]);
  if (principal) setSession(principal);
  mount();
  expect(screen.queryByRole('link', { name: 'Edit post' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Delete post' })).not.toBeInTheDocument();
});
it.each([session, { ...session, userId: 'extra-admin', role: 'admin' }])('permits an owner or any admin to follow the edit link', async (principal) => {
  savePosts([post]);
  setSession(principal);
  mount();
  expect(screen.getByRole('link', { name: 'Edit post' })).toHaveAttribute('href', '/edit/p1');
  await userEvent.setup().click(screen.getByRole('link', { name: 'Edit post' }));
  expect(screen.getByText('Edit destination')).toBeInTheDocument();
  expect(getPosts()).toEqual([post]);
});
it('resolves encoded identifiers and shows a crown for the built-in admin author', () => {
  savePosts([{ ...post, id: 'a/b', authorId: 'admin', authorName: 'Admin' }]);
  setSession({ ...session, role: 'admin' });
  mount('/blog/a%2Fb');
  expect(screen.getByRole('heading')).toHaveTextContent(post.title);
  expect(screen.getByText('👑')).toHaveClass('bg-violet-600');
  expect(screen.getByRole('link', { name: 'Edit post' })).toHaveAttribute('href', '/edit/a%2Fb');
});
it.each(['{', '[]', '[{"id":"broken"}]'])('shows not-found without repairing unusable or empty collections', (raw) => {
  localStorage.setItem('writespace_posts', raw);
  mount();
  expect(screen.getByRole('heading').textContent).toBe('Post not found');
  expect(localStorage.getItem('writespace_posts')).toBe(raw);
});
it('shows not-found when storage access throws', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('unavailable'); });
  mount();
  expect(screen.getByRole('heading').textContent).toBe('Post not found');
});
it('updates the resolved record when navigation changes the reader parameter', async () => {
  savePosts([post, { ...post, id: 'p2', title: 'Another note' }]);
  setSession(session);
  render(
    <MemoryRouter initialEntries={['/blog/p1']} future={future}>
      <App />
    </MemoryRouter>,
  );
  await userEvent.setup().click(screen.getByRole('link', { name: 'Back to blogs' }));
  await userEvent.setup().click(screen.getByRole('link', { name: 'Read Another note' }));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Another note');
});
it('does not write or remove persistent data during StrictMode mount and rerender', () => {
  savePosts([post]);
  setSession(session);
  const raw = localStorage.getItem('writespace_posts');
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  const element = (
    <StrictMode>
      <MemoryRouter initialEntries={['/blog/p1']} future={future}>
        <Routes>
          <Route path="/blog/:id" element={<ReadBlog />} />
        </Routes>
      </MemoryRouter>
    </StrictMode>
  );
  const view = render(element);
  view.rerender(element);
  expect(write).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  expect(localStorage.getItem('writespace_posts')).toBe(raw);
});


it.each([session, { ...session, role: 'admin', userId: 'extra-admin' }])(
  'confirms owner/admin deletion and removes only the selected fresh identifier', async (principal) => {
    savePosts([post]);
    setSession(principal);
    mount();
    const added = { ...post, id: 'new-in-another-tab' };
    savePosts([post, added]);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete post' }));
    expect(confirm).toHaveBeenCalledWith('Delete this post? This cannot be undone.');
    expect(screen.getByText('List destination')).toBeInTheDocument();
    expect(getPosts()).toEqual([added]);
  },
);

it('confirmation cancellation keeps the reader and all storage unchanged', async () => {
  savePosts([post]);
  setSession(session);
  mount();
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  await userEvent.setup().click(screen.getByRole('button', { name: 'Delete post' }));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(post.title);
  expect(screen.queryByText('List destination')).not.toBeInTheDocument();
  expect(write).not.toHaveBeenCalled();
  expect(getPosts()).toEqual([post]);
});

it('failed deletion stays on reader with actionable feedback and unchanged records', async () => {
  savePosts([post]);
  setSession(session);
  mount();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  await userEvent.setup().click(screen.getByRole('button', { name: 'Delete post' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Could not delete this post. Check browser storage');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(post.title);
  expect(screen.queryByText('List destination')).not.toBeInTheDocument();
  expect(getPosts()).toEqual([post]);
});

it.each(['guest', 'non-owner', 'ownership', 'missing', 'during-confirm'])(
  'rechecks fresh %s state for a previously visible delete button and retains failure feedback', async (change) => {
    savePosts([post]);
    setSession(session);
    mount();
    if (change === 'guest') localStorage.removeItem('writespace_session');
    if (change === 'non-owner') setSession({ ...session, userId: 'other' });
    if (change === 'ownership') savePosts([{ ...post, authorId: 'other' }]);
    if (change === 'missing') savePosts([]);
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      if (change === 'during-confirm') localStorage.removeItem('writespace_session');
      return true;
    });
    const raw = localStorage.getItem('writespace_posts');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete post' }));
    const message = ['guest', 'during-confirm'].includes(change) ? 'Log in again'
      : change === 'missing' ? 'Post not found' : 'own posts';
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByText('List destination')).not.toBeInTheDocument();
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem('writespace_posts')).toBe(raw);
  },
);
