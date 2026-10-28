/** Specify registration persistence and duplicate rejection using real browser actions. */
import { test, expect } from './fixtures.js';

test('registers a canonical account, retains it after logout, and rejects its duplicate username', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Create an account' }).click();
  await page.getByLabel('Display Name', { exact: true }).fill('Mira Writer');
  await page.getByLabel('Username', { exact: true }).fill('mira');
  await page.getByLabel('Email', { exact: true }).fill('mira@example.test');
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByLabel('Confirm Password', { exact: true }).fill('demo-only');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('navigation', { name: 'Account navigation' })).toBeVisible();
  const stored = await page.evaluate(() => ({
    users: JSON.parse(localStorage.getItem('writespace_users')),
    session: JSON.parse(localStorage.getItem('writespace_session')),
  }));
  expect(stored.users).toHaveLength(1);
  const account = stored.users[0];
  expect(account).toEqual({ id: expect.any(String), displayName: 'Mira Writer', username: 'mira', password: 'demo-only', role: 'user', createdAt: expect.any(String) });
  expect(account.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  expect(new Date(account.createdAt).toISOString()).toBe(account.createdAt);
  expect(stored.session).toEqual({ userId: account.id, username: 'mira', displayName: 'Mira Writer', role: 'user' });
  await page.getByRole('button', { name: 'Mira Writer account' }).click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByRole('link', { name: 'Create an account' }).click();
  await page.getByLabel('Display Name', { exact: true }).fill('Another Writer');
  await page.getByLabel('Username', { exact: true }).fill('mira');
  await page.getByLabel('Email', { exact: true }).fill('another@example.test');
  await page.getByLabel('Password', { exact: true }).fill('another-demo');
  await page.getByLabel('Confirm Password', { exact: true }).fill('another-demo');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('This username is already taken.');
  await expect(page).toHaveURL(/\/register$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(stored.users);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  await page.getByRole('link', { name: 'Login', exact: true }).last().click();
  await page.getByLabel('Username', { exact: true }).fill('mira');
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(stored.session);
});
