/** Verify pure role avatar rendering and unsupported-role fallback. */
import { StrictMode } from 'react';
import { it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar, getAvatar } from './Avatar.jsx';

it.each([['admin', '👑', 'bg-violet-600'], ['user', '📚', 'bg-indigo-500']])('renders the static %s avatar', (role, emoji, color) => {
  render(<Avatar role={role} />);
  expect(screen.getByText(emoji)).toHaveClass(color, 'rounded-full');
  expect(screen.getByText(emoji)).toHaveAttribute('aria-hidden', 'true');
});
it.each([undefined, null, 'unknown'])('falls back to a book for %s', (role) => {
  render(getAvatar(role));
  expect(screen.getByText('📚')).toHaveClass('bg-indigo-500');
});
it('defaults to reader and never writes during StrictMode rendering or updates', () => {
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  const view = render(<StrictMode><Avatar /></StrictMode>);
  expect(screen.getByText('📚')).toBeInTheDocument();
  view.rerender(<StrictMode><Avatar role="admin" /></StrictMode>);
  expect(screen.getByText('👑')).toBeInTheDocument();
  expect(write).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});
