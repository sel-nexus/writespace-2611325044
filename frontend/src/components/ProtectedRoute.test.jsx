/** Verify the guest/user/admin access matrix against real session storage. */
import { StrictMode } from 'react';
import { it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute.jsx';
import { setSession, getSession } from '../utils/auth.js';

const future = { v7_startTransition: true, v7_relativeSplatPath: true };

/** Expose the actual router destination for redirect assertions. */
function Destination() {
  return <p>{useLocation().pathname}</p>;
}

it.each([
  [null, false, '/login'], [null, true, '/login'],
  ['user', false, 'Private content'], ['user', true, '/blogs'],
  ['admin', false, 'Private content'], ['admin', true, 'Private content'],
])('handles role %s with adminOnly %s', (role, adminOnly, expected) => {
  const session = role ? { userId: 'u1', username: 'mira', displayName: 'Mira', role } : null;
  if (session) setSession(session);
  const before = localStorage.getItem('writespace_session');
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  render(
    <StrictMode>
      <MemoryRouter initialEntries={['/private']} future={future}>
        <Routes>
          <Route path="/private" element={<ProtectedRoute adminOnly={adminOnly}><p>Private content</p></ProtectedRoute>} />
          <Route path="*" element={<Destination />} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
  expect(screen.getByText(expected)).toBeInTheDocument();
  if (expected !== 'Private content') expect(screen.queryByText('Private content')).not.toBeInTheDocument();
  expect(getSession()).toEqual(session);
  expect(localStorage.getItem('writespace_session')).toBe(before);
  expect(write).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});

it.each(['{broken', JSON.stringify({ role: 'admin' }), JSON.stringify({ userId: 'u', username: 'm', displayName: 'M', role: 'owner' })])('treats malformed identity as guest without repairing bytes', (bytes) => {
  localStorage.setItem('writespace_session', bytes);
  render(
    <MemoryRouter future={future}>
      <Routes>
        <Route path="/" element={<ProtectedRoute><p>Private content</p></ProtectedRoute>} />
        <Route path="/login" element={<p>Login destination</p>} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByText('Login destination')).toBeInTheDocument();
  expect(localStorage.getItem('writespace_session')).toBe(bytes);
});

it('fails closed when session reads throw', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Unavailable'); });
  render(
    <MemoryRouter future={future}>
      <Routes>
        <Route path="/" element={<ProtectedRoute adminOnly><p>Private content</p></ProtectedRoute>} />
        <Route path="/login" element={<p>Login destination</p>} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByText('Login destination')).toBeInTheDocument();
});
