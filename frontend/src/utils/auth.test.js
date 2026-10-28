/** Exercise fail-closed session reads and explicit boolean writes/removal. */
import { expect, it, vi } from 'vitest';
import { getSession, setSession, clearSession } from './auth.js';

const session = { userId: 'u1', username: 'mira', displayName: 'Mira', role: 'user' };

it('returns null for an absent session without creating one', () => {
  expect(getSession()).toBeNull();
  expect(localStorage.length).toBe(0);
});
it.each(['user', 'admin'])('persists and reads a complete %s session', (role) => {
  const value = { ...session, role };
  expect(setSession(value)).toBe(true);
  expect(getSession()).toEqual(value);
  expect(localStorage.getItem('writespace_session')).toBe(JSON.stringify(value));
});
it.each(['{', 'null', '[]', '{}', 'true', '"user"'])('fails closed without repairing %s', (raw) => {
  localStorage.setItem('writespace_session', raw);
  expect(getSession()).toBeNull();
  expect(localStorage.getItem('writespace_session')).toBe(raw);
});
it.each(Object.keys(session))('rejects incomplete or wrong %s values', (field) => {
  for (const invalid of [undefined, null, 3, '', '   ']) {
    const bad = { ...session, [field]: invalid };
    localStorage.setItem('writespace_session', JSON.stringify(bad));
    expect(getSession()).toBeNull();
    expect(setSession(bad)).toBe(false);
  }
});
it('rejects unsupported roles and non-object write values', () => {
  for (const value of [null, [], 'admin', { ...session, role: 'owner' }]) expect(setSession(value)).toBe(false);
  localStorage.setItem('writespace_session', JSON.stringify({ ...session, role: 'owner' }));
  expect(getSession()).toBeNull();
});
it('guards a throwing storage property getter on all operations', () => {
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('private'); });
  expect(getSession()).toBeNull();
  expect(setSession(session)).toBe(false);
  expect(clearSession()).toBe(false);
});
it('guards absent storage on all operations', () => {
  vi.spyOn(window, 'localStorage', 'get').mockReturnValue(undefined);
  expect(getSession()).toBeNull();
  expect(setSession(session)).toBe(false);
  expect(clearSession()).toBe(false);
});
it('guards getItem errors without writing', () => {
  setSession(session);
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('read'); });
  const write = vi.spyOn(Storage.prototype, 'setItem');
  expect(getSession()).toBeNull();
  expect(write).not.toHaveBeenCalled();
});
it('reports write failure without replacing the existing principal', () => {
  setSession(session);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  expect(setSession({ ...session, role: 'admin' })).toBe(false);
  expect(getSession()).toEqual(session);
});
it('guards serialization errors and serialized shape changes', () => {
  const cyclic = { ...session };
  cyclic.extra = cyclic;
  expect(setSession(cyclic)).toBe(false);
  expect(setSession({ ...session, toJSON: () => null })).toBe(false);
  vi.spyOn(JSON, 'stringify').mockImplementation(() => { throw new Error('serialize'); });
  expect(setSession(session)).toBe(false);
  expect(getSession()).toBeNull();
});
it('removes only the session key and succeeds again when absent', () => {
  setSession(session);
  localStorage.setItem('writespace_posts', '[]');
  localStorage.setItem('writespace_users', '[]');
  expect(clearSession()).toBe(true);
  expect(getSession()).toBeNull();
  expect(localStorage.getItem('writespace_posts')).toBe('[]');
  expect(localStorage.getItem('writespace_users')).toBe('[]');
  expect(clearSession()).toBe(true);
});
it('reports failed removal and retains the session', () => {
  setSession(session);
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('remove'); });
  expect(clearSession()).toBe(false);
  expect(getSession()).toEqual(session);
});
