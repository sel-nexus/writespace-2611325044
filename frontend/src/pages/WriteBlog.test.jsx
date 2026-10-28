/** Verify accessible draft controls, current-state saves, guarded routes and failures. */
import { StrictMode } from 'react';
import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import WriteBlog from './WriteBlog.jsx';
import App from '../App.jsx';
import { getPosts, savePosts } from '../utils/storage.js';
import { setSession } from '../utils/auth.js';

const future = { v7_startTransition: true, v7_relativeSplatPath: true };
const session = { userId: 'u1', username: 'mira', displayName: 'Mira', role: 'user' };
const post = {
  id: 'p1', title: 'Original', content: 'Original body', authorId: 'u1', authorName: 'Mira',
  createdAt: '2026-03-04T00:00:00.000Z',
};

/** Mount the editor in strict routing with observable navigation destinations. */
function mount(path = '/write') {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]} future={future}>
        <Routes>
          <Route path="/write" element={<WriteBlog />} />
          <Route path="/edit/:id" element={<WriteBlog />} />
          <Route path="/blog/:id" element={<p>Reader destination</p>} />
          <Route path="/blogs" element={<p>List destination</p>} />
          <Route path="/login" element={<p>Login destination</p>} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
}

/** Enter a draft via actual labeled controls. */
async function fill(title = '  New title  ', content = 'New body\n\n  More text') {
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText('Title'));
  await user.type(screen.getByLabelText('Title'), title);
  await user.clear(screen.getByLabelText('Content'));
  await user.type(screen.getByLabelText('Content'), content);
  return user;
}

it('renders full-width required controls, textarea minimum height and a live draft counter', async () => {
  setSession(session);
  mount();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Write a post');
  expect(screen.getByLabelText('Title')).toHaveClass('w-full');
  expect(screen.getByLabelText('Content')).toHaveClass('w-full', 'min-h-64');
  expect(screen.getByLabelText('Content')).toHaveAttribute('aria-required', 'true');
  expect(screen.getByText('0 characters')).toBeInTheDocument();
  await userEvent.setup().type(screen.getByLabelText('Content'), 'Hello');
  expect(screen.getByText('5 characters')).toBeInTheDocument();
  expect(getPosts()).toEqual([]);
});

it('creates with current session, preserves new external records and navigates only on success', async () => {
  setSession(session);
  mount();
  const user = await fill();
  savePosts([post]);
  setSession({ ...session, userId: 'new-session', displayName: 'Current writer' });
  await user.click(screen.getByRole('button', { name: 'Save post' }));
  expect(screen.getByText('Reader destination')).toBeInTheDocument();
  expect(getPosts()).toHaveLength(2);
  expect(getPosts()[0]).toEqual(post);
  expect(getPosts()[1]).toMatchObject({ title: 'New title', content: 'New body\n\n  More text', authorId: 'new-session' });
});

it.each(['/write', '/edit/p1'])('shows associated required errors for whitespace drafts on %s', async (path) => {
  setSession(session);
  savePosts([post]);
  mount(path);
  const user = await fill('   ', ' \n ');
  const write = vi.spyOn(Storage.prototype, 'setItem');
  await user.click(screen.getByRole('button', { name: 'Save post' }));
  expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText('Title')).toHaveAttribute('aria-describedby', 'post-title-error');
  expect(screen.getByLabelText('Content')).toHaveAttribute('aria-describedby', 'post-counter post-content-error');
  expect(screen.getByText('Title is required.')).toHaveAttribute('role', 'alert');
  expect(screen.getByText('Content is required.')).toHaveAttribute('role', 'alert');
  expect(write).not.toHaveBeenCalled();
  expect(getPosts()).toEqual([post]);
});

it('clears validation on a corrected successful submission', async () => {
  setSession(session);
  mount();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Save post' }));
  expect(screen.getAllByRole('alert')).toHaveLength(2);
  const user = await fill();
  await user.click(screen.getByRole('button', { name: 'Save post' }));
  expect(screen.getByText('Reader destination')).toBeInTheDocument();
});

it.each([session, { ...session, role: 'admin', userId: 'extra-admin' }])(
  'loads and edits as owner/admin, preserving fresh identity and unrelated records', async (principal) => {
    savePosts([post]);
    setSession(principal);
    mount('/edit/p1');
    expect(screen.getByLabelText('Title')).toHaveValue('Original');
    expect(screen.getByLabelText('Content')).toHaveValue('Original body');
    const user = await fill();
    const fresh = { ...post, createdAt: '2026-05-03T00:00:00.000Z', authorName: 'Fresh identity' };
    const added = { ...post, id: 'p2' };
    savePosts([fresh, added]);
    await user.click(screen.getByRole('button', { name: 'Save post' }));
    expect(screen.getByText('Reader destination')).toBeInTheDocument();
    expect(getPosts()).toEqual([{ ...fresh, title: 'New title', content: 'New body\n\n  More text' }, added]);
  },
);

it.each(['/write', '/edit/p1'])('Cancel on %s leaves without saving draft changes', async (path) => {
  setSession(session);
  savePosts([post]);
  mount(path);
  const user = await fill();
  const write = vi.spyOn(Storage.prototype, 'setItem');
  await user.click(screen.getByRole('link', { name: 'Cancel' }));
  expect(screen.getByText('List destination')).toBeInTheDocument();
  expect(write).not.toHaveBeenCalled();
  expect(getPosts()).toEqual([post]);
});

it.each(['/write', '/edit/p1'])('redirects guests at route load on %s without writes', (path) => {
  savePosts([post]);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  mount(path);
  expect(screen.getByText('Login destination')).toBeInTheDocument();
  expect(write).not.toHaveBeenCalled();
});

it('redirects non-owner edit at route load without rendering draft or writing', () => {
  savePosts([post]);
  setSession({ ...session, userId: 'non-owner' });
  const write = vi.spyOn(Storage.prototype, 'setItem');
  mount('/edit/p1');
  expect(screen.getByText('List destination')).toBeInTheDocument();
  expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  expect(write).not.toHaveBeenCalled();
});

it.each(['missing', '{', '[]', '[{"id":"broken"}]'])('shows missing edit target for %s without repair', async (raw) => {
  setSession(session);
  if (raw !== 'missing') localStorage.setItem('writespace_posts', raw);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  mount('/edit/missing');
  expect(screen.getByRole('heading').textContent).toBe('Post not found');
  expect(screen.queryByRole('button', { name: 'Save post' })).not.toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('link', { name: 'Back to blogs' }));
  expect(screen.getByText('List destination')).toBeInTheDocument();
  expect(write).not.toHaveBeenCalled();
});

it.each(['/write', '/edit/p1'])('retains draft and view when session ends before submit on %s', async (path) => {
  savePosts([post]);
  setSession(session);
  mount(path);
  const user = await fill();
  localStorage.removeItem('writespace_session');
  const write = vi.spyOn(Storage.prototype, 'setItem');
  await user.click(screen.getByRole('button', { name: 'Save post' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Log in again');
  expect(screen.getByLabelText('Title')).toHaveValue('  New title  ');
  expect(screen.queryByText('Reader destination')).not.toBeInTheDocument();
  expect(write).not.toHaveBeenCalled();
});

it.each(['principal', 'ownership', 'missing'])('rechecks %s changes at edit submit without successful navigation', async (change) => {
  savePosts([post]);
  setSession(session);
  mount('/edit/p1');
  const user = await fill();
  if (change === 'principal') setSession({ ...session, userId: 'other' });
  if (change === 'ownership') savePosts([{ ...post, authorId: 'other' }]);
  if (change === 'missing') savePosts([]);
  const raw = localStorage.getItem('writespace_posts');
  const write = vi.spyOn(Storage.prototype, 'setItem');
  await user.click(screen.getByRole('button', { name: 'Save post' }));
  expect(screen.getByRole('alert')).toHaveTextContent(change === 'missing' ? 'Post not found' : 'own posts');
  expect(screen.getByLabelText('Content')).toHaveValue('New body\n\n  More text');
  expect(write).not.toHaveBeenCalled();
  expect(localStorage.getItem('writespace_posts')).toBe(raw);
});

it.each(['/write', '/edit/p1'])('retains draft and bytes on storage write failure on %s', async (path) => {
  savePosts([post]);
  setSession(session);
  mount(path);
  const user = await fill();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  await user.click(screen.getByRole('button', { name: 'Save post' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Check browser storage');
  expect(screen.getByLabelText('Title')).toHaveValue('  New title  ');
  expect(getPosts()).toEqual([post]);
});

it('shows UUID failure and retains an unsaved create draft', async () => {
  setSession(session);
  mount();
  const user = await fill();
  vi.stubGlobal('crypto', {});
  await user.click(screen.getByRole('button', { name: 'Save post' }));
  expect(screen.getByRole('alert')).toHaveTextContent('secure UUID support');
  expect(screen.getByLabelText('Title')).toHaveValue('  New title  ');
  expect(getPosts()).toEqual([]);
});

it.each(['/write', '/edit/p1'])('does not persist on StrictMode mount, rerender, or draft typing on %s', async (path) => {
  savePosts([post]);
  setSession(session);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  const view = mount(path);
  view.rerender(
    <StrictMode>
      <MemoryRouter initialEntries={[path]} future={future}>
        <Routes>
          <Route path="/write" element={<WriteBlog />} />
          <Route path="/edit/:id" element={<WriteBlog />} />
        </Routes>
      </MemoryRouter>
    </StrictMode>
  );
  await fill();
  expect(write).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  expect(getPosts()).toEqual([post]);
});

it.each(['/write', '/edit/p1'])('App guards its added %s route for a guest', (path) => {
  render(
    <MemoryRouter initialEntries={[path]} future={future}>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome back');
});

it('resets drafts on route parameter changes and when leaving edit for create', async () => {
  savePosts([post, { ...post, id: 'p2', title: 'Second' }]);
  setSession(session);
  render(
    <MemoryRouter initialEntries={['/edit/p1']} future={future}>
      <Link to="/edit/p2">Second editor</Link>
      <Link to="/write">Create editor</Link>
      <Routes>
        <Route path="/edit/:id" element={<WriteBlog />} />
        <Route path="/write" element={<WriteBlog />} />
      </Routes>
    </MemoryRouter>,
  );
  await fill();
  await userEvent.setup().click(screen.getByRole('link', { name: 'Second editor' }));
  expect(screen.getByLabelText('Title')).toHaveValue('Second');
  await userEvent.setup().click(screen.getByRole('link', { name: 'Create editor' }));
  expect(screen.getByLabelText('Title')).toHaveValue('');
  expect(getPosts()[0]).toEqual(post);
});
