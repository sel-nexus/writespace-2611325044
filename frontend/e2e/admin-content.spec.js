/** Specify admin content journeys using only UI setup and persisted outcome reads. */
import { test, expect } from './fixtures.js';

/** Read actual saved posts for assertions, never seed or replace browser state. */
async function posts(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')) || []);
}

/** Enter exact demo credentials through the real login controls.
 * Args:
 *   page: Browser page with fixture failure capture.
 *   username: Built-in or registered demo username.
 *   password: Matching demo password.
 */
async function login(page, username, password) {
  await page.getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
}

/** Leave the session using the actual account disclosure. */
async function logout(page, name) {
  await page.getByRole('button', { name: `${name} account`, exact: true }).click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** Save an authored post using the real writing form. */
async function write(page, title) {
  await page.getByRole('link', { name: 'Write', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Content', { exact: true }).fill(`Body for ${title}`);
  await page.getByRole('button', { name: 'Save post', exact: true }).click();
  await expect(page).toHaveURL(/\/blog\/[^/]+$/);
}

test('guest admin entry redirects to login without controls or persistence', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome back');
  await expect(page.getByRole('link', { name: 'Manage users', exact: true })).toHaveCount(0);
  expect(await posts(page)).toEqual([]);
});

test('admin login permits any-post edit and confirmed dashboard deletion while retaining unrelated posts', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Get Started', exact: true }).click();
  await page.getByLabel('Display Name', { exact: true }).fill('Owner Writer');
  await page.getByLabel('Username', { exact: true }).fill('owner');
  await page.getByLabel('Email', { exact: true }).fill('owner@example.test');
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByLabel('Confirm Password', { exact: true }).fill('demo-only');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await write(page, 'Writer-owned post');
  await write(page, 'Keep this post');
  const [original, retained] = await posts(page);
  await logout(page, 'Owner Writer');
  await login(page, 'admin', 'admin');
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Admin dashboard');
  const actions = page.getByRole('navigation', { name: 'Dashboard actions' });
  await expect(actions.getByRole('link', { name: 'Manage users' })).toHaveAttribute('href', '/users');
  await actions.getByRole('link', { name: 'Write', exact: true }).click();
  await expect(page).toHaveURL(/\/write$/);
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await page.getByRole('link', { name: 'Read Writer-owned post', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(original.title);
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await page.getByRole('link', { name: 'Edit Writer-owned post', exact: true }).click();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(original.title);
  await page.getByLabel('Title', { exact: true }).fill('Admin revision');
  await page.getByLabel('Content', { exact: true }).fill('Revised by admin');
  await page.getByRole('button', { name: 'Save post', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Admin revision');
  const edited = { ...original, title: 'Admin revision', content: 'Revised by admin' };
  expect(await posts(page)).toEqual([edited, retained]);
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete Admin revision', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  expect(await posts(page)).toEqual([edited, retained]);
  await expect(page.getByRole('article', { name: 'Admin revision', exact: true })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete Admin revision', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Post deleted.');
  await expect(page).toHaveURL(/\/admin$/);
  expect(await posts(page)).toEqual([retained]);
  await expect(page.getByRole('article', { name: 'Admin revision', exact: true })).toHaveCount(0);
  await expect(page.getByRole('article', { name: 'Keep this post', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Blogs', exact: true }).click();
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  expect(await posts(page)).toEqual([retained]);
  await expect(page.getByRole('article', { name: 'Keep this post', exact: true })).toBeVisible();

  await logout(page, 'Admin');
  await login(page, 'owner', 'demo-only');
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Manage users', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete Keep this post', exact: true })).toHaveCount(0);
  // Login routes the normal user to blogs; admin entry was rejected by the route unit matrix.
  expect(await posts(page)).toEqual([retained]);
});
