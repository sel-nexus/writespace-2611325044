/** Verify pure role display, responsive markup and eligible account intent callbacks. */
import { StrictMode } from 'react';
import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserRow } from './UserRow.jsx';

const user = { id: 'writer', displayName: 'Writer', username: 'writer', password: 'NEVER SHOW THIS',
  role: 'user', createdAt: '2026-03-01T00:00:00.000Z' };
const admin = { userId: 'admin', role: 'admin' };

/** Supply native table parents for the presentational row. */
function row(record = user, session = admin, onDelete = vi.fn()) {
  return (
    <StrictMode>
      <table>
        <tbody>
          <UserRow user={record} session={session} onDelete={onDelete} />
        </tbody>
      </table>
    </StrictMode>
  );
}

it.each(['user', 'admin'])('renders %s fields, date and static avatar but no password', (role) => {
  const { container } = render(row({ ...user, role }));
  expect(screen.getByRole('rowheader')).toHaveTextContent('Writer');
  expect(screen.getByText('@writer')).toBeInTheDocument();
  const badge = screen.getByText(role === 'admin' ? 'Admin' : 'User');
  expect(badge).toHaveClass(role === 'admin' ? 'bg-violet-100' : 'bg-indigo-100');
  expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent(role === 'admin' ? '👑' : '📚');
  expect(screen.getByText('Mar 01, 2026')).toHaveAttribute('datetime', user.createdAt);
  expect(container.textContent).not.toContain(user.password);
  expect(container.querySelector('input')).toBeNull();
  expect(screen.getByRole('row')).toHaveClass('block', 'sm:table-row');
});

it('emits only target identity for eligible delete and never writes on render, rerender or click', async () => {
  const onDelete = vi.fn();
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  const read = vi.spyOn(Storage.prototype, 'getItem');
  const element = row(user, admin, onDelete);
  const view = render(element);
  view.rerender(element);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Delete writer' }));
  expect(onDelete).toHaveBeenCalledWith(user.id);
  expect(write).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  expect(read).not.toHaveBeenCalled();
});

it.each([
  ['built-in', { ...user, id: 'admin', username: 'admin', role: 'admin' }, admin, 'Protected'],
  ['self', user, { userId: 'writer', role: 'admin' }, 'Current account'],
  ['guest', user, null, 'Admin access required'],
  ['nonadmin', user, { userId: 'other', role: 'user' }, 'Admin access required'],
])('hides deletion for %s and describes the restriction', (_, record, session, label) => {
  const onDelete = vi.fn();
  render(row(record, session, onDelete));
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.getByText(label)).toBeInTheDocument();
  expect(onDelete).not.toHaveBeenCalled();
});

it('allows an additional admin to remove another admin but updates self protection when props change', () => {
  const target = { ...user, role: 'admin' };
  const view = render(row(target, { userId: 'editor', role: 'admin' }));
  expect(screen.getByRole('button', { name: 'Delete writer' })).toBeInTheDocument();
  view.rerender(row(target, { userId: target.id, role: 'admin' }));
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.getByText('Current account')).toBeInTheDocument();
});
