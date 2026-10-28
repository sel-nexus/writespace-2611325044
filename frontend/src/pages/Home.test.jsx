/** Verify newest-first local listing, fallback views, guarded routes and purity. */
import { StrictMode } from 'react';
import { expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Home from './Home.jsx';
import App from '../App.jsx';
import { savePosts, getPosts } from '../utils/storage.js';
import { setSession } from '../utils/auth.js';

const future = { v7_startTransition: true, v7_relativeSplatPath: true };
const session = { userId: 'u1', username: 'mira', displayName: 'Mira', role: 'user' };
const post = { id: 'p1', title: 'Oldest', content: 'A thought.', authorId: 'u1', authorName: 'Mira', createdAt: '2026-03-01T12:00:00.000Z' };

/** Mount list or application in StrictMode at a requested memory route. */
function mount(element = <Home />, path = '/blogs') {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]} future={future}>
        {element}
      </MemoryRouter>
    </StrictMode>,
  );
}

it('lists every post newest first with repeating sorted borders and ownership links', () => {
  const records = [post, ...[5, 2, 4, 3].map((day) => ({ ...post, id: `p${day}`, title: `Note ${day}`, authorId: 'other', createdAt: `2026-03-0${day}T12:00:00.000Z` }))];
  savePosts(records);
  setSession(session);
  const raw = localStorage.getItem('writespace_posts');
  mount();
  const grid = screen.getByRole('region', { name: 'Saved posts' });
  expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3');
  expect(screen.getByRole('main')).toHaveClass('max-w-6xl');
  const cards = within(grid).getAllByRole('article');
  expect(cards.map((card) => within(card).getByRole('heading').textContent)).toEqual(['Note 5', 'Note 4', 'Note 3', 'Note 2', 'Oldest']);
  const colors = ['border-indigo-600', 'border-violet-600', 'border-pink-500', 'border-teal-500', 'border-indigo-600'];
  cards.forEach((card, index) => expect(card).toHaveClass(colors[index]));
  expect(screen.getAllByRole('link', { name: /^Edit / })).toHaveLength(1);
  expect(screen.getByRole('link', { name: 'Edit Oldest' })).toHaveAttribute('href', '/edit/p1');
  expect(localStorage.getItem('writespace_posts')).toBe(raw);
  expect(getPosts()).toEqual(records);
});
it('shows no cards and follows the empty Write CTA to its future route', async () => {
  mount(
    <Routes>
      <Route path="/blogs" element={<Home />} />
      <Route path="/write" element={<p>Write destination</p>} />
    </Routes>,
  );
  expect(screen.getByRole('heading', { name: 'No posts yet' })).toBeInTheDocument();
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('link', { name: 'Write a post' }));
  expect(screen.getByText('Write destination')).toBeInTheDocument();
});
it.each(['{', '[{"id":"broken"}]'])('preserves unusable storage while showing empty UI', (raw) => {
  localStorage.setItem('writespace_posts', raw);
  mount();
  expect(screen.getByRole('heading', { name: 'No posts yet' })).toBeInTheDocument();
  expect(localStorage.getItem('writespace_posts')).toBe(raw);
});
it('degrades to empty when storage reads throw', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('unavailable'); });
  mount();
  expect(screen.getByRole('heading', { name: 'No posts yet' })).toBeInTheDocument();
});
it('shows all edit links to an additional admin', () => {
  savePosts([post, { ...post, id: 'p2', authorId: 'other' }]);
  setSession({ ...session, userId: 'additional-admin', role: 'admin' });
  mount();
  expect(screen.getAllByRole('link', { name: /^Edit / })).toHaveLength(2);
});
it.each(['/blogs', '/blog/p1'])('redirects guests at %s without exposing saved content', (path) => {
  savePosts([post]);
  mount(<App />, path);
  expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Oldest' })).not.toBeInTheDocument();
});
it('follows Read and Write links to real pages without persisting an unsaved draft', async () => {
  savePosts([post]);
  setSession(session);
  const rawStorage = { ...localStorage };
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  const user = userEvent.setup();
  mount(<App />);
  expect(screen.getByText(/Demo only: passwords are stored/)).toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'Read Oldest' }));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Oldest');
  await user.click(screen.getByRole('link', { name: 'Back to blogs' }));
  expect(screen.getByRole('heading', { name: 'Blogs' })).toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'Write a post' }));
  expect(screen.getByRole('heading', { name: 'Write a post' })).toBeInTheDocument();
  expect(screen.getByLabelText('Title')).toHaveValue('');
  expect(screen.getByLabelText('Content')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Save post' })).toHaveAttribute('type', 'submit');
  expect({ ...localStorage }).toEqual(rawStorage);
  await user.type(screen.getByLabelText('Title'), 'Unsaved idea');
  await user.type(screen.getByLabelText('Content'), 'Draft words stay in the form.');
  expect(screen.getByLabelText('Title')).toHaveValue('Unsaved idea');
  expect(screen.getByLabelText('Content')).toHaveValue('Draft words stay in the form.');
  expect({ ...localStorage }).toEqual(rawStorage);
  expect(getPosts()).toEqual([post]);
  expect(write).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});
it('does not write or remove data on StrictMode mount and rerender', () => {
  savePosts([post]);
  setSession(session);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  const view = mount();
  view.rerender(
    <StrictMode>
      <MemoryRouter initialEntries={['/blogs']} future={future}>
        <Home />
      </MemoryRouter>
    </StrictMode>,
  );
  expect(write).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  expect(getPosts()).toEqual([post]);
});
