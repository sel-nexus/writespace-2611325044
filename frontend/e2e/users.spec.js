/** Specify UI-created accounts and fixture-backed initial route boundaries. */
import { test, expect } from './fixtures.js';

/** Read actual local collections without seeding or replacing browser data. */
async function stored(page, key) {
  return page.evaluate((name) => localStorage.getItem(name), key);
}

/** Enter an account through the actual public login controls. */
async function login(page, username, password) {
  const menu = page.getByRole('button', { name: 'Open menu', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
}

/** Leave via the account disclosure, opening mobile navigation when needed. */
async function logout(page, displayName) {
  const menu = page.getByRole('button', { name: 'Open menu', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: `${displayName} account`, exact: true }).click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** Open account administration from the existing responsive navigation. */
async function users(page) {
  const menu = page.getByRole('button', { name: 'Open menu', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('link', { name: 'Users', exact: true }).click();
  await expect(page).toHaveURL(/\/users$/);
}

/** Create the account through required labeled controls. */
async function create(page, role = 'user') {
  await page.getByLabel('Display Name', { exact: true }).fill('New Writer');
  await page.getByLabel('Username', { exact: true }).fill('new-writer');
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByLabel('Role', { exact: true }).selectOption(role);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Account created for new-writer.');
}

test('guest initial users entry redirects to login without account content or storage changes', async ({ page }) => {
  const storage = {
    writespace_users: JSON.stringify([{
      id: 'writer', displayName: 'Writer', username: 'writer', password: 'demo-only',
      role: 'user', createdAt: '2025-01-01T00:00:00.000Z',
    }]),
    writespace_posts: JSON.stringify([]),
    unrelated: 'keep this value',
  };
  await page.addInitScript((entries) => {
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
  }, storage);
  await page.goto('/users');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome back');
  await expect(page.getByRole('heading', { name: 'User management', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Create a local account' })).toHaveCount(0);
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toHaveCount(0);
  expect(await stored(page, 'writespace_session')).toBeNull();
  expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))).toEqual(storage);
});

test('normal-user initial users entry redirects to blogs without account content or storage changes', async ({ page }) => {
  const user = {
    id: 'writer', displayName: 'Writer', username: 'writer', password: 'demo-only',
    role: 'user', createdAt: '2025-01-01T00:00:00.000Z',
  };
  const storage = {
    writespace_users: JSON.stringify([user]),
    writespace_posts: JSON.stringify([]),
    writespace_session: JSON.stringify({
      userId: user.id, username: user.username, displayName: user.displayName, role: user.role,
    }),
    unrelated: 'keep this value',
  };
  await page.addInitScript((entries) => {
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
  }, storage);
  await page.goto('/users');
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Blogs');
  await expect(page.getByRole('button', { name: 'Writer account', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'User management', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Create a local account' })).toHaveCount(0);
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Delete / })).toHaveCount(0);
  expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))).toEqual(storage);
});

test('dashboard Manage users opens the real account form and list and returns through account navigation', async ({ page }) => {
  await page.goto('/');
  await login(page, 'admin', 'admin');
  await expect(page).toHaveURL(/\/admin$/);
  const original = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  await page.getByRole('navigation', { name: 'Dashboard actions' })
    .getByRole('link', { name: 'Manage users', exact: true }).click();
  await expect(page).toHaveURL(/\/users$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('User management');
  const form = page.getByRole('region', { name: 'Create a local account' });
  await expect(form.getByLabel('Display Name', { exact: true })).toHaveValue('');
  await expect(form.getByLabel('Username', { exact: true })).toHaveValue('');
  await expect(form.getByLabel('Password', { exact: true })).toHaveValue('');
  await expect(form.getByLabel('Role', { exact: true })).toHaveValue('');
  await expect(form.getByRole('button', { name: 'Create account', exact: true })).toBeVisible();
  await expect(page.getByRole('table')).toContainText('@admin');
  await expect(page.getByRole('table')).toContainText('Protected');
  await expect(page.getByText('No local accounts yet. The built-in admin is always available.', { exact: true })).toBeVisible();
  await form.getByLabel('Display Name', { exact: true }).fill('Unsaved account');
  await page.getByRole('navigation', { name: 'Account navigation' })
    .getByRole('link', { name: 'Dashboard', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Admin dashboard');
  expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))).toEqual(original);
});

test('admin-created account logs in, authors a post, and is deleted without changing the post', async ({ page }) => {
  await page.goto('/');
  await login(page, 'admin', 'admin');
  await expect(page).toHaveURL(/\/admin$/);
  await users(page);
  await expect(page.getByText('Protected', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete admin', exact: true })).toHaveCount(0);
  await expect(page.getByRole('main').getByText(/Demo only: passwords are stored in plain text/)).toBeVisible();
  await create(page);
  const [created] = JSON.parse(await stored(page, 'writespace_users'));
  expect(created).toEqual({ id: expect.any(String), displayName: 'New Writer', username: 'new-writer', password: 'demo-only', role: 'user', createdAt: expect.any(String) });
  expect(created.id).toMatch(/^[0-9a-f-]{36}$/i);
  await expect(page.getByRole('table')).not.toContainText(created.password);
  await logout(page, 'Admin');
  expect(await stored(page, 'writespace_session')).toBeNull();
  await login(page, 'new-writer', 'demo-only');
  await expect(page).toHaveURL(/\/blogs$/);
  await page.getByRole('link', { name: 'Write', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Account removal preserves this post');
  await page.getByLabel('Content', { exact: true }).fill('Written by the new local account.');
  await page.getByRole('button', { name: 'Save post', exact: true }).click();
  await expect(page).toHaveURL(/\/blog\/[^/]+$/);
  const posts = await stored(page, 'writespace_posts');
  expect(JSON.parse(posts)[0]).toMatchObject({ authorId: created.id, authorName: created.displayName });
  await logout(page, 'New Writer');
  await login(page, 'admin', 'admin');
  await users(page);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete new-writer', exact: true }).click();
  await expect(page.getByText('@new-writer', { exact: true })).toBeVisible();
  expect(JSON.parse(await stored(page, 'writespace_users'))).toEqual([created]);
  expect(await stored(page, 'writespace_posts')).toBe(posts);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete new-writer', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Account deleted. Posts were not changed.');
  await expect(page).toHaveURL(/\/users$/);
  expect(JSON.parse(await stored(page, 'writespace_users'))).toEqual([]);
  expect(await stored(page, 'writespace_posts')).toBe(posts);
  await page.getByRole('link', { name: 'Blogs', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Account removal preserves this post', exact: true })).toBeVisible();
  await logout(page, 'Admin');
  await login(page, 'new-writer', 'demo-only');
  await expect(page.getByRole('alert')).toContainText('Invalid');
  expect(await stored(page, 'writespace_posts')).toBe(posts);
});

test('mobile cards protect built-in/current admin and cancel eligible deletion without changes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await login(page, 'admin', 'admin');
  await users(page);
  await expect(page.getByText('Protected', { exact: true })).toBeVisible();
  await create(page, 'admin');
  const original = await stored(page, 'writespace_users');
  await expect(page.getByRole('columnheader', { name: 'Username', exact: true })).toHaveCount(0);
  await expect(page.getByText('@new-writer', { exact: true })).toBeVisible();
  await expect(page.getByRole('table')).not.toContainText('demo-only');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete new-writer', exact: true }).click();
  expect(await stored(page, 'writespace_users')).toBe(original);
  await logout(page, 'Admin');
  await login(page, 'new-writer', 'demo-only');
  await expect(page).toHaveURL(/\/admin$/);
  await users(page);
  await expect(page.getByText('Current account', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Delete / })).toHaveCount(0);
  expect(await stored(page, 'writespace_users')).toBe(original);
  expect(await stored(page, 'writespace_posts')).toBeNull();
});
