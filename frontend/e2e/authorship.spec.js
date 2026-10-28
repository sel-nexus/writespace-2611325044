/** Specify real browser-local authorship journeys without mocked storage or navigation. */
import { test, expect } from './fixtures.js';

/** Register through the account-entry UI from the public landing page.
 * Args:
 *   page: Real browser page with the fixture's failure capture.
 *   name: Display name used for ownership assertions and account controls.
 *   username: Unique local demo account name.
 */
async function register(page, name, username) {
  await page.getByRole('link', { name: 'Get Started', exact: true }).click();
  await page.getByLabel('Display Name', { exact: true }).fill(name);
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(`${username}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByLabel('Confirm Password', { exact: true }).fill('demo-only');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
}

/** Create through labeled writing controls and wait for the persisted reader route. */
async function write(page, title, content) {
  await page.getByRole('link', { name: 'Write', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Content', { exact: true }).fill(content);
  await page.getByRole('button', { name: 'Save post', exact: true }).click();
  await expect(page).toHaveURL(/\/blog\/[^/]+$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
}

/** Log out through the real account disclosure without clearing unrelated data. */
async function logout(page, name) {
  await page.getByRole('button', { name: `${name} account`, exact: true }).click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** Read persisted posts solely for outcome assertions, never seed test state. */
async function posts(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')) || []);
}

for (const path of ['/write', '/edit/missing']) {
  test(`guest entry at ${path} redirects to login without creating data`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome back');
    await expect(page.getByRole('button', { name: 'Save post', exact: true })).toHaveCount(0);
    expect(await posts(page)).toEqual([]);
  });
}

test('non-owner initial edit entry for an existing post redirects to blogs without editor content or storage changes', async ({ page }) => {
  const owner = {
    id: 'owner', displayName: 'Owner Writer', username: 'owner', password: 'demo-only',
    role: 'user', createdAt: '2025-01-01T00:00:00.000Z',
  };
  const visitor = { ...owner, id: 'visitor', displayName: 'Other Writer', username: 'visitor' };
  const post = {
    id: 'existing-target', title: 'Owner-only draft', content: 'Existing saved body.',
    authorId: owner.id, authorName: owner.displayName, createdAt: owner.createdAt,
  };
  const storage = {
    writespace_users: JSON.stringify([owner, visitor]),
    writespace_posts: JSON.stringify([post]),
    writespace_session: JSON.stringify({
      userId: visitor.id, username: visitor.username, displayName: visitor.displayName, role: visitor.role,
    }),
    unrelated: 'keep this value',
  };
  await page.addInitScript((entries) => {
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
  }, storage);
  await page.goto('/edit/existing-target');
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Blogs');
  await expect(page.getByRole('heading', { name: post.title, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Other Writer account', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Edit post', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Post not found', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Title', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Content', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save post', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: `Edit ${post.title}`, exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))).toEqual(storage);
});

test('list-card Edit selects the existing owned post and Cancel preserves all saved posts', async ({ page }) => {
  await page.goto('/');
  await register(page, 'Card Writer', 'card-writer');
  await write(page, 'Selected card', 'Selected existing body.');
  await write(page, 'Unrelated card', 'Keep this unrelated body.');
  const original = await posts(page);
  const selected = original[0];
  const storage = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  await page.getByRole('link', { name: 'Back to blogs', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  const card = page.getByRole('article').filter({
    has: page.getByRole('heading', { name: selected.title, exact: true }),
  });
  await card.getByRole('link', { name: `Edit ${selected.title}`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/edit/${selected.id}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Edit post');
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(selected.title);
  await expect(page.getByLabel('Content', { exact: true })).toHaveValue(selected.content);
  await page.getByLabel('Title', { exact: true }).fill('Unsaved card revision');
  await page.getByLabel('Content', { exact: true }).fill('Unsaved replacement body.');
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('heading', { name: selected.title, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Unrelated card', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Unsaved card revision', exact: true })).toHaveCount(0);
  expect(await posts(page)).toEqual(original);
  expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))).toEqual(storage);
});

test('registers, writes, reloads, reads, edits and confirms deletion while retaining unrelated posts', async ({ page }) => {
  await page.goto('/');
  await register(page, 'Mira Writer', 'mira');
  await write(page, 'A lasting note', 'First line\n\n  Indented line');
  const [original] = await posts(page);
  expect(original).toMatchObject({ title: 'A lasting note', authorName: 'Mira Writer' });
  expect(original.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  expect(new Date(original.createdAt).toISOString()).toBe(original.createdAt);
  const principal = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')));
  expect(original.authorId).toBe(principal.userId);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(original.title);
  expect(await posts(page)).toEqual([original]);
  expect(await page.locator('article .whitespace-pre-wrap').textContent()).toBe(original.content);

  await page.getByRole('link', { name: 'Edit post', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Unsaved draft');
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await posts(page)).toEqual([original]);
  await page.getByRole('link', { name: 'Read A lasting note', exact: true }).click();
  await page.getByRole('link', { name: 'Edit post', exact: true }).click();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(original.title);
  await page.getByLabel('Title', { exact: true }).fill('Revised note');
  await page.getByLabel('Content', { exact: true }).fill('Revised body\n\nStill plaintext.');
  await page.getByRole('button', { name: 'Save post', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/blog/${original.id}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Revised note');
  const edited = { ...original, title: 'Revised note', content: 'Revised body\n\nStill plaintext.' };
  expect(await posts(page)).toEqual([edited]);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Revised note');
  expect(await posts(page)).toEqual([edited]);

  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete post', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/blog/${original.id}$`));
  expect(await posts(page)).toEqual([edited]);
  await write(page, 'Keep this one', 'Unrelated body');
  const retained = (await posts(page))[1];
  await page.getByRole('link', { name: 'Back to blogs', exact: true }).click();
  await page.getByRole('link', { name: 'Read Revised note', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete post', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await posts(page)).toEqual([retained]);
  await expect(page.getByRole('heading', { name: 'Revised note', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Keep this one', exact: true })).toBeVisible();
  expect(await posts(page)).toEqual([retained]);
});

test('admin edits and deletes another writer’s post without changing its author identity', async ({ page }) => {
  await page.goto('/');
  await register(page, 'Owner Writer', 'owner');
  await write(page, 'Owned by a writer', 'Writer body');
  const [original] = await posts(page);
  await logout(page, 'Owner Writer');
  await page.getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('link', { name: 'Blogs', exact: true }).click();
  await page.getByRole('link', { name: 'Read Owned by a writer', exact: true }).click();
  await page.getByRole('link', { name: 'Edit post', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Admin revision');
  await page.getByRole('button', { name: 'Save post', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Admin revision');
  expect(await posts(page)).toEqual([{ ...original, title: 'Admin revision' }]);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete post', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await posts(page)).toEqual([]);
});

test('guest preview requires login and another registered writer has no management controls', async ({ page }) => {
  await page.goto('/');
  await register(page, 'First Writer', 'first');
  await write(page, 'Private ownership', 'Publicly previewed, locally saved.');
  const original = await posts(page);
  await logout(page, 'First Writer');
  await page.getByRole('link', { name: 'Private ownership', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Save post', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await register(page, 'Second Writer', 'second');
  await page.getByRole('link', { name: 'Read Private ownership', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Private ownership');
  await expect(page.getByRole('link', { name: 'Edit post', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete post', exact: true })).toHaveCount(0);
  expect(await posts(page)).toEqual(original);
});

