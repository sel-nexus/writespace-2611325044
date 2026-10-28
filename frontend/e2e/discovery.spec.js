/** Exercise real discovery links and local previews without implementing future pages. */
import { test, expect } from './fixtures.js';

test('guest links navigate and the unmatched view returns to discovery', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your thoughts. Your space. Beautifully simple.');
  for (const [label, route] of [['Get Started', '/register'], ['Login', '/login'], ['Get Started Free', '/register'], ['Start Reading', '/login']]) {
    await page.getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await page.getByRole('link', { name: 'Back to WriteSpace' }).click();
    await expect(page).toHaveURL(/\/$/);
  }
});

test('three newest local previews use real links and retain persisted records', async ({ page }) => {
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
  await latest.getByRole('link', { name: 'Local story 4' }).click();
  await expect(page).toHaveURL(/\/blog\/p4$/);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to WriteSpace' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts);
});

test('empty mobile discovery has usable disclosure, links and no overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Login', exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('link', { name: 'Login', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('link', { name: 'Back to WriteSpace' }).click();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('button', { name: 'Close menu' }).click();
  await expect(page.getByRole('link', { name: 'Login', exact: true })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.locator('.motion-safe\\:animate-float').evaluate((card) => getComputedStyle(card).animationName)).toBe('none');
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});
