/** Verify guest, role, active-route, and mobile disclosure navigation. */
import { StrictMode } from 'react';
import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PublicNavbar } from './PublicNavbar.jsx';

const session = { userId: 'u1', username: 'mira', displayName: 'Mira', role: 'user' };
const future = { v7_startTransition: true, v7_relativeSplatPath: true };

/** Render the public navigation in an isolated router. */
function mount(value = null, path = '/') {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]} future={future}>
        <PublicNavbar session={value} />
      </MemoryRouter>
    </StrictMode>,
  );
}

it('shows guest entry links, brand home, and a skip link', () => {
  mount();
  expect(screen.getByRole('link', { name: 'WriteSpace' })).toHaveAttribute('href', '/');
  expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
  expect(screen.getByRole('link', { name: 'Get Started' })).toHaveAttribute('href', '/register');
  expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main-content');
  expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
});
it.each([['user', '/blogs', '📚'], ['admin', '/admin', '👑']])('shows %s identity and its dashboard only', (role, href, emoji) => {
  mount({ ...session, role });
  expect(screen.getByText('Mira')).toBeInTheDocument();
  expect(screen.getByText(emoji)).toHaveAttribute('aria-hidden', 'true');
  expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', href);
  expect(screen.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Get Started' })).not.toBeInTheDocument();
});
it('toggles mobile disclosure by keyboard and closes it after navigation', async () => {
  const user = userEvent.setup();
  mount();
  const toggle = screen.getByRole('button', { name: 'Open menu' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  toggle.focus();
  await user.keyboard('{Enter}');
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(document.getElementById(toggle.getAttribute('aria-controls'))).toHaveClass('flex');
  await user.click(screen.getByRole('link', { name: 'Login' }));
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('aria-current', 'page');
  await user.click(toggle);
  await user.click(screen.getByRole('button', { name: 'Close menu' }));
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
});
it('does not change persistent data on mount or prop updates', () => {
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  const view = mount();
  view.rerender(
    <MemoryRouter future={future}>
      <PublicNavbar session={session} />
    </MemoryRouter>,
  );
  expect(screen.getByText('Mira')).toBeInTheDocument();
  expect(write).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});
