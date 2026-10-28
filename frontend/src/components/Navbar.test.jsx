/** Verify authenticated links, disclosures, logout outcomes, and render purity. */
import { StrictMode } from 'react';
import { it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar.jsx';
import App from '../App.jsx';
import { getSession, setSession } from '../utils/auth.js';

const session = { userId: 'u1', username: 'mira', displayName: 'Mira', role: 'user' };
const future = { v7_startTransition: true, v7_relativeSplatPath: true };

/** Expose the current route alongside persistent navigation. */
function Location() {
  return <p>Route {useLocation().pathname}</p>;
}

/** Mount authenticated navigation in an isolated StrictMode router. */
function mount(role = 'user', path = '/blogs', onLogout) {
  setSession({ ...session, role });
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]} future={future}>
        <Navbar session={{ ...session, role }} onLogout={onLogout} />
        <Location />
      </MemoryRouter>
    </StrictMode>,
  );
}

it.each(['user', 'admin'])('shows only permitted %s links and active styling', (role) => {
  mount(role);
  expect(screen.getByRole('link', { name: 'Blogs' })).toHaveAttribute('href', '/blogs');
  expect(screen.getByRole('link', { name: 'Blogs' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Blogs' })).toHaveClass('bg-indigo-600', 'rounded-full');
  expect(screen.getByRole('link', { name: 'Write' })).toHaveAttribute('href', '/write');
  expect(screen.getByRole('link', { name: 'WriteSpace' })).toHaveAttribute('href', '/');
  expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main-content');
  expect(screen.getByText(/Demo only:/)).toBeInTheDocument();
  if (role === 'admin') {
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/admin');
    expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/users');
    expect(screen.getByText('👑')).toHaveClass('bg-violet-600');
  } else {
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
    expect(screen.getByText('📚')).toHaveClass('bg-indigo-500');
  }
  expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
});

it('toggles mobile links with keyboard and closes both disclosures on navigation', async () => {
  const user = userEvent.setup();
  mount();
  const toggle = screen.getByRole('button', { name: 'Open menu' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(document.getElementById(toggle.getAttribute('aria-controls'))).toHaveClass('hidden');
  toggle.focus();
  await user.keyboard('{Enter}');
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(document.getElementById(toggle.getAttribute('aria-controls'))).toHaveClass('flex');
  await user.click(screen.getByRole('button', { name: 'Mira account' }));
  expect(screen.getByRole('button', { name: 'Logout' })).toBeVisible();
  await user.click(screen.getByRole('link', { name: 'Write' }));
  expect(screen.getByText('Route /write')).toBeInTheDocument();
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByRole('button', { name: 'Mira account' })).toHaveAttribute('aria-expanded', 'false');
  await user.click(toggle);
  await user.click(screen.getByRole('button', { name: 'Close menu' }));
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

it('reveals logout by keyboard, toggles closed, and restores focus on Escape', async () => {
  const user = userEvent.setup();
  mount();
  const trigger = screen.getByRole('button', { name: 'Mira account' });
  trigger.focus();
  await user.keyboard('{Enter}');
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect(document.getElementById(trigger.getAttribute('aria-controls'))).toHaveTextContent('@mira');
  await user.click(trigger);
  expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
  await user.click(trigger);
  screen.getByRole('button', { name: 'Logout' }).focus();
  await user.keyboard('{Escape}');
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

it.each(['user', 'admin'])('removes only the %s session and navigates home on logout', async (role) => {
  localStorage.setItem('writespace_users', 'account bytes');
  localStorage.setItem('writespace_posts', 'post bytes');
  const user = userEvent.setup();
  mount(role);
  await user.click(screen.getByRole('button', { name: 'Mira account' }));
  await user.click(screen.getByRole('button', { name: 'Logout' }));
  expect(getSession()).toBeNull();
  expect(localStorage.getItem('writespace_session')).toBeNull();
  expect(localStorage.getItem('writespace_users')).toBe('account bytes');
  expect(localStorage.getItem('writespace_posts')).toBe('post bytes');
  expect(screen.getByText('Route /')).toBeInTheDocument();
});

it('notifies the shell only after successful removal', async () => {
  const observed = [];
  const user = userEvent.setup();
  mount('user', '/blogs', () => observed.push(getSession()));
  await user.click(screen.getByRole('button', { name: 'Mira account' }));
  await user.click(screen.getByRole('button', { name: 'Logout' }));
  expect(observed).toEqual([null]);
});

it.each(['user', 'admin'])('keeps %s session, route, and visible account state on removal failure then permits explicit retry', async (role) => {
  const observed = [];
  const user = userEvent.setup();
  mount(role, '/blogs', () => observed.push(getSession()));
  const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('Blocked'); });
  await user.click(screen.getByRole('button', { name: 'Mira account' }));
  await user.click(screen.getByRole('button', { name: 'Logout' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Could not log out.');
  expect(screen.getByRole('button', { name: 'Logout' })).toBeVisible();
  expect(screen.getByText('Route /blogs')).toBeInTheDocument();
  expect(getSession()).toEqual({ ...session, role });
  expect(observed).toEqual([]);
  remove.mockRestore();
  await user.click(screen.getByRole('button', { name: 'Logout' }));
  expect(getSession()).toBeNull();
  expect(screen.getByText('Route /')).toBeInTheDocument();
  expect(observed).toEqual([null]);
});

it('preserves the authenticated App shell on failed logout at root', async () => {
  setSession(session);
  const user = userEvent.setup();
  render(
    <StrictMode>
      <MemoryRouter future={future}>
        <App />
      </MemoryRouter>
    </StrictMode>,
  );
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('Blocked'); });
  await user.click(screen.getByRole('button', { name: 'Mira account' }));
  await user.click(screen.getByRole('button', { name: 'Logout' }));
  expect(getSession()).toEqual(session);
  expect(screen.getByRole('navigation', { name: 'Account navigation' })).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'Public navigation' })).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Could not log out.');
});

it('never mutates persistence during mount, rerender, or disclosure actions', async () => {
  const user = userEvent.setup();
  setSession(session);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  const view = render(
    <StrictMode>
      <MemoryRouter future={future}>
        <Navbar session={session} />
        <Location />
      </MemoryRouter>
    </StrictMode>,
  );
  view.rerender(
    <StrictMode>
      <MemoryRouter future={future}>
        <Navbar session={session} />
        <Location />
      </MemoryRouter>
    </StrictMode>,
  );
  await user.click(screen.getByRole('button', { name: 'Mira account' }));
  await user.click(screen.getByRole('button', { name: 'Open menu' }));
  expect(getSession()).toEqual(session);
  expect(write).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});
