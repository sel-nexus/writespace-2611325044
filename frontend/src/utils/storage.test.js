/** Exercise whole-record collection validation and every persistence failure boundary. */
import { describe, expect, it, vi } from 'vitest';
import { getPosts, getUsers, savePosts, saveUsers } from './storage.js';

const post = { id: 'p1', title: 'A note', content: 'Words', createdAt: '2026-03-04T12:00:00.000Z', authorId: 'u1', authorName: 'Mira' };
const user = { id: 'u1', displayName: 'Mira', username: 'mira', password: 'demo', role: 'user', createdAt: post.createdAt };

describe.each([
  ['posts', 'writespace_posts', getPosts, savePosts, post],
  ['users', 'writespace_users', getUsers, saveUsers, user],
])('%s collection', (_name, key, read, save, record) => {
  it('reads absent and valid empty collections without creating data', () => {
    expect(read()).toEqual([]);
    expect(localStorage.getItem(key)).toBeNull();
    expect(save([])).toBe(true);
    expect(read()).toEqual([]);
  });
  it('replaces and reads a complete collection without touching other keys', () => {
    localStorage.setItem('unrelated', 'keep');
    const records = [record];
    expect(save(records)).toBe(true);
    expect(read()).toEqual(records);
    expect(localStorage.getItem('unrelated')).toBe('keep');
    expect(records).toEqual([record]);
    const loaded = read();
    loaded[0].id = 'different';
    expect(read()[0].id).toBe(record.id);
  });
  it.each(['{', 'null', '{}', '"text"', '3', '[null]', '[[]]'])('returns [] without repairing invalid bytes %s', (raw) => {
    localStorage.setItem(key, raw);
    expect(read()).toEqual([]);
    expect(localStorage.getItem(key)).toBe(raw);
  });
  it.each(Object.keys(record))('rejects the entire array for missing or mistyped %s', (field) => {
    for (const invalid of [undefined, null, 3, '']) {
      const bad = { ...record, [field]: invalid };
      const raw = JSON.stringify([record, bad]);
      localStorage.setItem(key, raw);
      expect(read()).toEqual([]);
      expect(save([record, bad])).toBe(false);
      expect(localStorage.getItem(key)).toBe(raw);
    }
  });
  it.each(['not-a-date', '2026-02-30T12:00:00.000Z', '2026-03-04', '2026-03-04T99:00:00Z'])('rejects unusable timestamp %s', (createdAt) => {
    expect(save([{ ...record, createdAt }])).toBe(false);
    localStorage.setItem(key, JSON.stringify([{ ...record, createdAt }]));
    expect(read()).toEqual([]);
  });
  it('rejects non-arrays and sparse arrays without overwriting valid data', () => {
    expect(save([record])).toBe(true);
    for (const bad of [null, {}, 'text', [record, null], new Array(1)]) expect(save(bad)).toBe(false);
    expect(read()).toEqual([record]);
  });
  it('guards the storage property getter for both reads and writes', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('private'); });
    expect(read()).toEqual([]);
    expect(save([record])).toBe(false);
  });
  it('guards unavailable storage and a throwing getItem', () => {
    const spy = vi.spyOn(window, 'localStorage', 'get').mockReturnValue(undefined);
    expect(read()).toEqual([]);
    expect(save([record])).toBe(false);
    spy.mockRestore();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('read'); });
    expect(read()).toEqual([]);
  });
  it('reports a failed write and retains existing data', () => {
    expect(save([record])).toBe(true);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(save([])).toBe(false);
    expect(read()).toEqual([record]);
  });
  it('guards serialization exceptions and invalid serialized shapes', () => {
    const cycle = { ...record };
    cycle.extra = cycle;
    expect(save([cycle])).toBe(false);
    expect(save([{ ...record, toJSON: () => null }])).toBe(false);
    const serialize = vi.spyOn(JSON, 'stringify').mockImplementation(() => { throw new Error('serialize'); });
    expect(save([record])).toBe(false);
    serialize.mockRestore();
    expect(localStorage.getItem(key)).toBeNull();
  });
});

it('accepts an admin account and rejects unsupported account roles', () => {
  expect(saveUsers([{ ...user, role: 'admin' }])).toBe(true);
  expect(getUsers()[0].role).toBe('admin');
  expect(saveUsers([{ ...user, role: 'owner' }])).toBe(false);
  localStorage.setItem('writespace_users', JSON.stringify([{ ...user, role: 'owner' }]));
  expect(getUsers()).toEqual([]);
});
