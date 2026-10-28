/** Verify fresh-state mutation policy and exact browser-local collection changes. */
import { beforeEach, expect, it, vi } from 'vitest';
import { canManagePost, createPost, deletePost, editPost } from './posts.js';
import { getPosts, savePosts } from './storage.js';
import { setSession } from './auth.js';

const session = { userId: 'u1', username: 'mira', displayName: 'Mira', role: 'user' };
const post = {
  id: 'p1', title: 'Original', content: 'Original body', createdAt: '2026-03-04T00:00:00.000Z',
  authorId: 'u1', authorName: 'Mira',
};
const other = { ...post, id: 'p2', authorId: 'other', title: 'Unrelated' };
const values = { title: '  New title  ', content: '  New body\n\n  Indented text  ' };

beforeEach(() => {
  savePosts([post, other]);
  setSession(session);
});

it.each([
  [post, session, true], [post, { ...session, userId: 'other' }, false],
  [post, { ...session, userId: 'extra', role: 'admin' }, true], [post, null, false],
  [null, session, false], [undefined, undefined, false], [post, {}, false],
  [post, { ...session, role: 'unknown' }, false], [{}, session, false],
  [post, { ...session, userId: '' }, false],
])('checks eligibility for target %j and principal %j without writes', (target, principal, allowed) => {
  const write = vi.spyOn(Storage.prototype, 'setItem');
  expect(canManagePost(target, principal)).toBe(allowed);
  expect(write).not.toHaveBeenCalled();
});

it.each(['user', 'admin'])('creates as current %s with UUID, ISO time, trimmed text and no supplied identity', (role) => {
  const uuid = 'e0ac8369-6897-4e56-a097-8198c116ca3a';
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(uuid);
  setSession({ ...session, role, userId: 'fresh', displayName: 'Fresh name' });
  const result = createPost({ ...values, id: 'fake', authorId: 'fake', createdAt: 'fake' });
  expect(result.ok).toBe(true);
  expect(result.post).toEqual({
    id: uuid, title: 'New title', content: 'New body\n\n  Indented text',
    authorId: 'fresh', authorName: 'Fresh name', createdAt: expect.any(String),
  });
  expect(new Date(result.post.createdAt).toISOString()).toBe(result.post.createdAt);
  expect(result.posts).toEqual([post, other, result.post]);
  expect(getPosts()).toEqual(result.posts);
});

it('creates from an empty collection without mount-time seeding', () => {
  localStorage.removeItem('writespace_posts');
  const result = createPost(values);
  expect(result.ok).toBe(true);
  expect(getPosts()).toEqual([result.post]);
});

it.each([undefined, null, {}, { title: 1, content: false }, { title: '', content: ' ' },
  { title: 'ok' }, { content: 'ok' }, { title: ' \n ', content: 'body' }])(
  'rejects invalid create input %j with actionable field errors and unchanged bytes', (input) => {
    const raw = localStorage.getItem('writespace_posts');
    const result = createPost(input);
    expect(result).toMatchObject({ ok: false, code: 'VALIDATION_FAILED', errors: expect.any(Object) });
    expect(result.message).toMatch(/title and content/);
    expect(localStorage.getItem('writespace_posts')).toBe(raw);
  },
);

it.each([createPost, (input) => editPost('p1', input), () => deletePost('p1')])(
  'denies a missing or invalid current session', (action) => {
    localStorage.setItem('writespace_session', '{"role":"admin"}');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(action(values)).toMatchObject({ ok: false, code: 'SESSION_REQUIRED', message: expect.stringMatching(/Log in/) });
    expect(write).not.toHaveBeenCalled();
    expect(getPosts()).toEqual([post, other]);
  },
);

it.each([undefined, {}, { randomUUID: () => { throw new Error('no UUID'); } }])(
  'surfaces unavailable UUID support %j without writing', (unavailable) => {
    vi.stubGlobal('crypto', unavailable);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(createPost(values)).toMatchObject({ ok: false, code: 'UUID_UNAVAILABLE' });
    expect(write).not.toHaveBeenCalled();
    expect(getPosts()).toEqual([post, other]);
  },
);

it.each([session, { ...session, userId: 'extra-admin', role: 'admin', displayName: 'Different name' }])(
  'edits only title/content as owner or admin while preserving every fresh identity field', (principal) => {
    setSession(principal);
    const fresh = { ...post, createdAt: '2026-05-02T00:00:00.000Z', authorName: 'Fresh author', extra: 'retained' };
    savePosts([fresh, other]);
    const result = editPost('p1', { ...values, id: 'fake', authorName: 'fake', createdAt: 'fake' });
    expect(result).toEqual({
      ok: true, post: { ...fresh, title: 'New title', content: 'New body\n\n  Indented text' },
      posts: [{ ...fresh, title: 'New title', content: 'New body\n\n  Indented text' }, other],
    });
    expect(getPosts()).toEqual(result.posts);
  },
);

it.each([undefined, {}, { title: 'ok', content: ' \n ' }, { title: 4, content: 'ok' }])(
  'rejects invalid edit input %j without modifying the target', (input) => {
    expect(editPost('p1', input)).toMatchObject({ ok: false, code: 'VALIDATION_FAILED' });
    expect(getPosts()).toEqual([post, other]);
  },
);

it.each([undefined, '', 'missing', 1])('rejects missing edit/delete target %j without writes', (id) => {
  const write = vi.spyOn(Storage.prototype, 'setItem');
  expect(editPost(id, values)).toMatchObject({ ok: false, code: 'POST_NOT_FOUND' });
  expect(deletePost(id)).toMatchObject({ ok: false, code: 'POST_NOT_FOUND' });
  expect(write).not.toHaveBeenCalled();
});

it.each(['[]', '{', '[{"id":"p1"}]'])('fails missing edit/delete on unusable collection %s without repair', (raw) => {
  localStorage.setItem('writespace_posts', raw);
  expect(editPost('p1', values)).toMatchObject({ ok: false, code: 'POST_NOT_FOUND' });
  expect(deletePost('p1')).toMatchObject({ ok: false, code: 'POST_NOT_FOUND' });
  expect(localStorage.getItem('writespace_posts')).toBe(raw);
});

it('re-reads ownership and refuses edit/delete after a target is reassigned', () => {
  savePosts([{ ...post, authorId: 'new-owner' }, other]);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  expect(editPost('p1', values)).toMatchObject({ ok: false, code: 'PERMISSION_DENIED' });
  expect(deletePost('p1')).toMatchObject({ ok: false, code: 'PERMISSION_DENIED' });
  expect(write).not.toHaveBeenCalled();
  expect(getPosts()[0].title).toBe('Original');
});

it.each([session, { ...session, role: 'admin', userId: 'extra-admin' }])(
  'deletes only the selected id as owner or admin and returns remaining records', (principal) => {
    setSession(principal);
    const result = deletePost('p1');
    expect(result).toEqual({ ok: true, post, posts: [other] });
    expect(getPosts()).toEqual([other]);
  },
);

it('re-reads both the collection and session on every successive mutation', () => {
  const created = createPost(values).post;
  const added = { ...other, id: 'new-from-another-tab' };
  savePosts([post, other, created, added]);
  setSession({ ...session, userId: 'other' });
  expect(editPost(created.id, values).code).toBe('PERMISSION_DENIED');
  setSession({ ...session, userId: 'admin', role: 'admin' });
  expect(editPost(created.id, { title: 'Admin edit', content: 'Changed' }).ok).toBe(true);
  expect(deletePost(created.id).posts).toEqual([post, other, added]);
  expect(getPosts()).toEqual([post, other, added]);
});

it.each([createPost, (input) => editPost('p1', input), () => deletePost('p1')])(
  'reports write failure without success data or unrelated storage changes', (action) => {
    const raw = localStorage.getItem('writespace_posts');
    const principal = localStorage.getItem('writespace_session');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(action(values)).toMatchObject({ ok: false, code: 'STORAGE_WRITE_FAILED' });
    expect(localStorage.getItem('writespace_posts')).toBe(raw);
    expect(localStorage.getItem('writespace_session')).toBe(principal);
    expect(localStorage.getItem('writespace_users')).toBeNull();
  },
);
