/** Verify fresh account policy, canonical storage and unrelated-data preservation. */
import { beforeEach, expect, it, vi } from 'vitest';
import { createUser, deleteUser } from './users.js';
import { getUsers, saveUsers, savePosts } from './storage.js';
import { setSession } from './auth.js';

const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
const values = { displayName: 'Jane Doe', username: 'jane', password: 'demo-only', role: 'user' };
const saved = { ...values, id: 'jane-id', createdAt: '2026-03-01T00:00:00.000Z' };
const post = { id: 'post-id', title: 'Keep', content: 'Body', authorId: saved.id, authorName: saved.displayName, createdAt: saved.createdAt };

beforeEach(() => { setSession(admin); saveUsers([saved]); savePosts([post]); });

it.each(['user', 'admin'])('creates canonical %s UUID/time fields and preserves existing users, session and posts', (role) => {
  const session = localStorage.getItem('writespace_session');
  const posts = localStorage.getItem('writespace_posts');
  const start = Date.now();
  const result = createUser({ ...values, username: 'new', role, id: 'spoof', email: 'ignored@example.test', createdAt: 'bad' });
  expect(result.ok).toBe(true);
  expect(result.user).toEqual({ ...values, username: 'new', role, id: expect.any(String), createdAt: expect.any(String) });
  expect(result.user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  expect(new Date(result.user.createdAt).toISOString()).toBe(result.user.createdAt);
  expect(Date.parse(result.user.createdAt)).toBeGreaterThanOrEqual(start);
  expect(Date.parse(result.user.createdAt)).toBeLessThanOrEqual(Date.now());
  expect(getUsers()).toEqual([saved, result.user]);
  expect(result.users).toEqual(getUsers());
  expect(localStorage.getItem('writespace_posts')).toBe(posts);
  expect(localStorage.getItem('writespace_session')).toBe(session);
});

it.each([
  ['displayName', ''], ['username', ''], ['password', ''], ['role', ''],
  ['displayName', '  '], ['username', '  '], ['password', '  '],
  ['displayName', null], ['username', 2], ['password', {}], ['role', 'owner'], ['role', 3],
])('rejects required/invalid %s value %s without writes', (field, value) => {
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const result = createUser({ ...values, username: 'new', [field]: value });
  expect(result).toMatchObject({ ok: false, code: 'VALIDATION_FAILED', errors: { [field]: expect.any(String) } });
  expect(write).not.toHaveBeenCalled();
  expect(getUsers()).toEqual([saved]);
});

it('rejects absent input with all required field errors', () => {
  expect(createUser()).toMatchObject({ ok: false, errors: {
    displayName: expect.any(String), username: expect.any(String), password: expect.any(String), role: expect.any(String),
  } });
  expect(getUsers()).toEqual([saved]);
});

it.each([['admin', 'RESERVED_USERNAME'], ['jane', 'DUPLICATE_USERNAME']])('rejects exact username %s', (username, code) => {
  const write = vi.spyOn(Storage.prototype, 'setItem');
  expect(createUser({ ...values, username })).toMatchObject({ ok: false, code, errors: { username: expect.any(String) } });
  expect(write).not.toHaveBeenCalled();
});

it('keeps username/password exact and only trims display name', () => {
  const result = createUser({ ...values, displayName: ' Jane ', username: 'Jane', password: ' demo ' });
  expect(result.ok).toBe(true);
  expect(getUsers()[1]).toMatchObject({ displayName: 'Jane', username: 'Jane', password: ' demo ' });
  expect(createUser({ ...values, username: ' admin ' }).ok).toBe(true);
});

it('detects a duplicate from a fresh collection on the next action', () => {
  expect(createUser({ ...values, username: 'new' }).ok).toBe(true);
  const raw = localStorage.getItem('writespace_users');
  expect(createUser({ ...values, username: 'new' }).code).toBe('DUPLICATE_USERNAME');
  expect(localStorage.getItem('writespace_users')).toBe(raw);
});

it.each([createUser, deleteUser])('requires fresh guest/nonadmin permission on every helper action', (operation) => {
  const input = operation === createUser ? { ...values, username: 'new' } : saved.id;
  setSession({ ...admin, role: 'user' });
  expect(operation(input)).toMatchObject({ ok: false, code: 'PERMISSION_DENIED' });
  localStorage.removeItem('writespace_session');
  const write = vi.spyOn(Storage.prototype, 'setItem');
  expect(operation(input)).toMatchObject({ ok: false, code: 'SESSION_REQUIRED' });
  expect(write).not.toHaveBeenCalled();
  expect(getUsers()).toEqual([saved]);
});

it('accepts an additional admin and deletes only a fresh target, leaving posts and session byte-identical', () => {
  setSession({ ...admin, userId: 'editor', username: 'editor' });
  const added = { ...saved, id: 'other', username: 'other' };
  saveUsers([saved, added]);
  const posts = localStorage.getItem('writespace_posts');
  const session = localStorage.getItem('writespace_session');
  expect(deleteUser(saved.id)).toEqual({ ok: true, user: saved, users: [added] });
  expect(getUsers()).toEqual([added]);
  expect(localStorage.getItem('writespace_posts')).toBe(posts);
  expect(localStorage.getItem('writespace_session')).toBe(session);
  expect(deleteUser(added.id).ok).toBe(true);
  expect(getUsers()).toEqual([]);
});

it.each(['admin', 'missing', undefined])('denies built-in/missing target %s without writing', (id) => {
  const write = vi.spyOn(Storage.prototype, 'setItem');
  expect(deleteUser(id)).toMatchObject({ ok: false, code: id === 'admin' ? 'PROTECTED_ACCOUNT' : 'USER_NOT_FOUND' });
  expect(write).not.toHaveBeenCalled();
  expect(getUsers()).toEqual([saved]);
});

it('protects the built-in admin even if present in local users', () => {
  const builtIn = { ...saved, id: 'admin', username: 'admin', role: 'admin' };
  saveUsers([builtIn, saved]);
  expect(deleteUser('admin').code).toBe('PROTECTED_ACCOUNT');
  expect(getUsers()).toEqual([builtIn, saved]);
});

it('rejects self-deletion using the fresh principal rather than a prior admin session', () => {
  setSession({ ...admin, userId: saved.id });
  const write = vi.spyOn(Storage.prototype, 'setItem');
  expect(deleteUser(saved.id).code).toBe('SELF_DELETE_FORBIDDEN');
  expect(write).not.toHaveBeenCalled();
  expect(getUsers()).toEqual([saved]);
});

it('fails closed if the fresh selected account disappeared', () => {
  saveUsers([]);
  expect(deleteUser(saved.id).code).toBe('USER_NOT_FOUND');
  expect(getUsers()).toEqual([]);
});

it.each([createUser, deleteUser])('reports write failure without saved success data or changes to any collection', (operation) => {
  const users = localStorage.getItem('writespace_users');
  const posts = localStorage.getItem('writespace_posts');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  const result = operation(operation === createUser ? { ...values, username: 'new' } : saved.id);
  expect(result).toMatchObject({ ok: false, code: 'STORAGE_WRITE_FAILED', message: expect.stringContaining('Check browser storage') });
  expect(result.users).toBeUndefined();
  expect(result.user).toBeUndefined();
  expect(localStorage.getItem('writespace_users')).toBe(users);
  expect(localStorage.getItem('writespace_posts')).toBe(posts);
});

it('reports unavailable UUID generation without creating an account', () => {
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('unavailable'); });
  expect(createUser({ ...values, username: 'new' }).code).toBe('UUID_UNAVAILABLE');
  expect(getUsers()).toEqual([saved]);
});
