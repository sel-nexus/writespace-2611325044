/** Specify real UI-created account journeys; read storage only to assert outcomes. */
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
