/** Exercise public account entry, guarded local previews, and discovery states. */
import { test, expect } from './fixtures.js';

test('guest links navigate to account pages and return to discovery', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your thoughts. Your space. Beautifully simple.');
  await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('discovery-desktop-empty.png'), fullPage: true });
  for (const [label, route, heading] of [
    ['Get Started', '/register', 'Create an account'],
    ['Login', '/login', 'Welcome back'],
    ['Get Started Free', '/register', 'Create an account'],
    ['Start Reading', '/login', 'Welcome back'],
  ]) {
    await page.getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your thoughts. Your space. Beautifully simple.');
  }
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test('an initial unknown address shows the unmatched view and returns to discovery', async ({ page }) => {
  await page.goto('/unknown');
  await expect(page).toHaveURL(/\/unknown$/);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to WriteSpace' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your thoughts. Your space. Beautifully simple.');
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test('three newest local previews send guests to login and retain persisted records', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const posts = [1, 4, 2, 3].map((day) => ({
    id: `p${day}`, title: `Local story ${day}`, content: `Words for story ${day}`,
    authorId: 'u1', authorName: 'Mira', createdAt: `2026-03-0${day}T12:00:00.000Z`,
  }));
  await page.addInitScript((records) => { localStorage.setItem('writespace_posts', JSON.stringify(records)); }, posts);
  await page.goto('/');
  const latest = page.getByRole('region', { name: 'Latest from the Blog' });
  await expect(latest.getByRole('article')).toHaveCount(3);
  await expect(latest.getByRole('heading', { level: 3 })).toHaveText(['Local story 4', 'Local story 3', 'Local story 2']);
  await expect(latest.getByText('Words for story 4')).toBeVisible();
  await expect(latest.getByRole('link', { name: 'Local story 4' })).toHaveAttribute('href', '/blog/p4');
  await page.screenshot({ path: testInfo.outputPath('discovery-desktop-populated.png'), fullPage: true });
  await latest.getByRole('link', { name: 'Local story 4' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByText('Words for story 4', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Local story 4' })).toHaveCount(0);
  await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(latest.getByRole('heading', { level: 3 })).toHaveText(['Local story 4', 'Local story 3', 'Local story 2']);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts);
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe(JSON.stringify(posts));
  expect(await page.evaluate(() => localStorage.length)).toBe(1);
});

test('empty mobile discovery has usable disclosure, links and no overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Login', exact: true })).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('discovery-mobile-empty.png'), fullPage: true });
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('link', { name: 'Login', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('discovery-mobile-open-navigation.png'), fullPage: true });
  await page.getByRole('link', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('button', { name: 'Close menu' }).click();
  await expect(page.getByRole('link', { name: 'Login', exact: true })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.locator('.motion-safe\\:animate-float').evaluate((card) => getComputedStyle(card).animationName)).toBe('none');
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});
