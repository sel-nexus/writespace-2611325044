/** Verify exact discovery content, preview boundaries, purity, and route session refresh. */
import { StrictMode } from 'react';
import { expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from './LandingPage.jsx';
import App from '../App.jsx';
import { savePosts } from '../utils/storage.js';
import { setSession, clearSession } from '../utils/auth.js';

const future = { v7_startTransition: true, v7_relativeSplatPath: true };
const session = { userId: 'u1', username: 'mira', displayName: 'Mira', role: 'user' };
const post = { id: 'p1', title: 'First note', content: 'A short thought.', authorId: 'u1', authorName: 'Mira', createdAt: '2026-03-01T12:00:00.000Z' };

/** Mount a discovery view with a real memory route and StrictMode. */
function mount(element = <LandingPage />, path = '/') {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]} future={future}>
        {element}
      </MemoryRouter>
    </StrictMode>,
  );
}

it('renders the exact tagline, three feature names, empty copy and security notice', () => {
  mount();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your thoughts. Your space. Beautifully simple.');
  const features = screen.getByRole('region', { name: 'Less clutter. More writing.' });
  expect(within(features).getAllByRole('article')).toHaveLength(3);
  for (const name of ['Write Freely', 'Private & Local', 'Instant & Fast']) expect(within(features).getByRole('heading', { name })).toBeInTheDocument();
  expect(screen.getByText('No posts yet — check back soon!')).toBeInTheDocument();
  expect(screen.getByText('Demo only: passwords are stored in plain text and access checks run in your browser. Do not use real passwords or sensitive data.')).toBeInTheDocument();
});
it.each([null, session, { ...session, role: 'admin' }])('uses the session only to choose Start Reading', (value) => {
  mount(<LandingPage session={value} />);
  expect(screen.getByRole('link', { name: 'Start Reading' })).toHaveAttribute('href', value ? '/blogs' : '/login');
  expect(screen.getByRole('link', { name: 'Get Started Free' })).toHaveAttribute('href', '/register');
});
it('shows only the latest three, newest first, with safe text, dates, excerpts and links', () => {
  const records = [
    post,
    { ...post, id: 'p3', title: '<img src=x onerror=alert(1)>', content: 'x'.repeat(121), createdAt: '2026-03-03T12:00:00.000Z' },
    { ...post, id: 'p2', title: 'Second note', createdAt: '2026-03-02T12:00:00.000Z' },
    { ...post, id: 'p4', title: 'Newest note', createdAt: '2026-03-04T12:00:00.000Z' },
  ];
  savePosts(records);
  const raw = localStorage.getItem('writespace_posts');
  mount();
  const latest = screen.getByRole('region', { name: 'Latest from the Blog' });
  const cards = within(latest).getAllByRole('article');
  expect(cards).toHaveLength(3);
  expect(cards.map((card) => within(card).getByRole('link').textContent)).toEqual(['Newest note', records[1].title, 'Second note']);
  expect(within(latest).queryByText('First note')).not.toBeInTheDocument();
  expect(within(cards[0]).getByRole('link')).toHaveAttribute('href', '/blog/p4');
  expect(within(cards[0]).getByText('Mar 04, 2026')).toBeInTheDocument();
  expect(within(cards[0]).getByText('By Mira')).toBeInTheDocument();
  expect(within(cards[1]).getByText(`${'x'.repeat(120)}…`)).toBeInTheDocument();
  expect(cards[1].querySelector('img')).toBeNull();
  expect(cards[0]).toHaveClass('border-indigo-600');
  expect(cards[1]).toHaveClass('border-violet-600');
  expect(cards[2]).toHaveClass('border-pink-500');
  expect(localStorage.getItem('writespace_posts')).toBe(raw);
  expect(records[0].id).toBe('p1');
});
it('preserves content at the excerpt boundary and encodes post identifiers', () => {
  savePosts([{ ...post, id: 'a/b', content: 'x'.repeat(120) }]);
  mount();
  expect(screen.getByText('x'.repeat(120))).toBeInTheDocument();
  expect(screen.getByRole('link', { name: post.title })).toHaveAttribute('href', '/blog/a%2Fb');
});
it('uses the graceful empty view for corrupt and unavailable storage', () => {
  localStorage.setItem('writespace_posts', '[{"id":"broken"}]');
  const view = mount();
  expect(screen.getByText('No posts yet — check back soon!')).toBeInTheDocument();
  expect(localStorage.getItem('writespace_posts')).toBe('[{"id":"broken"}]');
  view.unmount();
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('private'); });
  mount(<App />);
  expect(screen.getByText('No posts yet — check back soon!')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
});
it('never writes or removes data during StrictMode mount and rerender', () => {
  savePosts([post]);
  setSession(session);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  const view = mount(<App />);
  view.rerender(
    <StrictMode>
      <MemoryRouter future={future}>
        <App />
      </MemoryRouter>
    </StrictMode>,
  );
  expect(write).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});
it.each(['/login', '/register', '/blogs', '/blog/p1', '/write', '/edit/p1', '/admin', '/users', '/unknown'])('renders a real unmatched view and working back link for %s', async (path) => {
  const user = userEvent.setup();
  mount(<App />, path);
  expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'Back to WriteSpace' }));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your thoughts. Your space. Beautifully simple.');
});
it('follows actual signup, reading and preview links into unmatched routes', async () => {
  const user = userEvent.setup();
  savePosts([post]);
  mount(<App />);
  for (const label of ['Get Started Free', 'Start Reading', post.title]) {
    await user.click(screen.getByRole('link', { name: label }));
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Back to WriteSpace' }));
  }
});
it('re-reads changed, cleared and malformed sessions and posts on route changes', async () => {
  const user = userEvent.setup();
  mount(<App />);
  await user.click(screen.getByRole('link', { name: 'Login' }));
  setSession(session);
  savePosts([post]);
  await user.click(screen.getByRole('link', { name: 'Back to WriteSpace' }));
  expect(screen.getByText('Mira', { selector: 'span' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/blogs');
  expect(screen.getByRole('link', { name: 'Start Reading' })).toHaveAttribute('href', '/blogs');
  expect(screen.getByRole('link', { name: post.title })).toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'Dashboard' }));
  setSession({ ...session, role: 'admin', displayName: 'Admin Mira' });
  await user.click(screen.getByRole('link', { name: 'Back to WriteSpace' }));
  expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/admin');
  await user.click(screen.getByRole('link', { name: 'Dashboard' }));
  clearSession();
  await user.click(screen.getByRole('link', { name: 'Back to WriteSpace' }));
  expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'Login' }));
  localStorage.setItem('writespace_session', '{');
  await user.click(screen.getByRole('link', { name: 'Back to WriteSpace' }));
  expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
  expect(localStorage.getItem('writespace_session')).toBe('{');
});
