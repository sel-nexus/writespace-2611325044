/** Verify preview boundaries, role affordances, navigation, and render purity. */
import { StrictMode } from 'react';
import { it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { BlogCard } from './BlogCard.jsx';
import { getPosts, savePosts } from '../utils/storage.js';
import { getSession, setSession } from '../utils/auth.js';

const post = { id: 'a/b', title: 'A note', content: 'A short thought.', authorId: 'u1', authorName: 'Mira', createdAt: '2026-03-04T00:00:00.000Z' };
const session = { userId: 'u1', username: 'mira', displayName: 'Mira', role: 'user' };
const future = { v7_startTransition: true, v7_relativeSplatPath: true };

/** Mount a card using actual validated persisted records and memory navigation. */
function mount({ record = post, principal = session, index, onEdit } = {}) {
  expect(savePosts([record])).toBe(true);
  if (principal) expect(setSession(principal)).toBe(true);
  return render(
    <StrictMode>
      <MemoryRouter future={future}>
        <Routes>
          <Route path="/" element={<BlogCard post={getPosts()[0]} session={getSession()} index={index} onEdit={onEdit} />} />
          <Route path="/blog/:id" element={<p>Reader destination</p>} />
          <Route path="/edit/:id" element={<p>Edit destination</p>} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
}

it('shows title, author, UTC padded date, avatar and an encoded working Read link', async () => {
  mount();
  expect(screen.getByRole('heading')).toHaveTextContent(post.title);
  expect(screen.getByText('By Mira')).toBeInTheDocument();
  expect(screen.getByText('Mar 04, 2026')).toHaveAttribute('datetime', post.createdAt);
  expect(screen.getByText('📚')).toHaveClass('bg-indigo-500');
  expect(screen.getByRole('link', { name: 'Read A note' })).toHaveAttribute('href', '/blog/a%2Fb');
  await userEvent.setup().click(screen.getByRole('link', { name: 'Read A note' }));
  expect(screen.getByText('Reader destination')).toBeInTheDocument();
});
it.each([1, 119, 120, 121, 240])('limits a %s-character body to 120 characters with an ellipsis only when truncated', (length) => {
  const content = 'x'.repeat(length);
  mount({ record: { ...post, content } });
  const excerpt = screen.getByRole('article').querySelector('p');
  expect(excerpt.textContent).toBe(content.slice(0, 120) + (content.length > 120 ? '…' : ''));
});
it.each([
  [0, 'border-indigo-600'], [1, 'border-violet-600'], [2, 'border-pink-500'],
  [3, 'border-teal-500'], [4, 'border-indigo-600'], [7, 'border-teal-500'],
])('uses the repeating border at sorted index %s', (index, color) => {
  mount({ index });
  expect(screen.getByRole('article')).toHaveClass('border-t-4', color);
});
it.each([null, { ...session, userId: 'other' }])('hides Edit from a guest or non-owner', (principal) => {
  mount({ principal });
  expect(screen.queryByRole('link', { name: 'Edit A note' })).not.toBeInTheDocument();
});
it.each([session, { ...session, userId: 'extra-admin', role: 'admin' }])('allows owner or any admin to follow Edit and notifies only on selection', async (principal) => {
  const onEdit = vi.fn();
  mount({ principal, onEdit });
  expect(onEdit).not.toHaveBeenCalled();
  expect(screen.getByRole('link', { name: 'Edit A note' })).toHaveAttribute('href', '/edit/a%2Fb');
  await userEvent.setup().click(screen.getByRole('link', { name: 'Edit A note' }));
  expect(screen.getByText('Edit destination')).toBeInTheDocument();
  expect(onEdit).toHaveBeenCalledWith(post);
});
it('supports an omitted edit callback and the built-in admin author avatar', async () => {
  mount({ record: { ...post, authorId: 'admin' }, principal: { ...session, role: 'admin' } });
  expect(screen.getByText('👑')).toHaveClass('bg-violet-600');
  await userEvent.setup().click(screen.getByRole('link', { name: 'Edit A note' }));
  expect(screen.getByText('Edit destination')).toBeInTheDocument();
});
it('renders markup as text and never mutates storage or supplied objects on StrictMode rerender', () => {
  const record = Object.freeze({ ...post, title: '<img src=x>', content: '<script>alert(1)</script>' });
  savePosts([record]);
  setSession(session);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  const element = (
    <StrictMode>
      <MemoryRouter future={future}>
        <BlogCard post={record} session={session} />
      </MemoryRouter>
    </StrictMode>
  );
  const view = render(element);
  view.rerender(element);
  expect(screen.getByRole('heading')).toHaveTextContent(record.title);
  expect(screen.getByRole('article').querySelector('img, script')).toBeNull();
  expect(write).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  expect(getPosts()).toEqual([record]);
});
