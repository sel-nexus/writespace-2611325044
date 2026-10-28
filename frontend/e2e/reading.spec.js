/** Specify real browser-local reading journeys; use UI links after initial entry. */
import { test, expect } from './fixtures.js';

const session = { userId: 'reader-1', username: 'mira', displayName: 'Mira Reader', role: 'user' };
const post = { id: 'note-1', title: 'Browser-local story', content: 'First line\n\n  Indented line\n<script>window.readingInjected = true</script>\n<img src=x onerror="window.readingInjected = true">', authorId: 'reader-1', authorName: 'Mira Reader', createdAt: '2026-03-04T00:00:00.000Z' };

/** Seed real storage only once so reload verifies persisted data rather than reseeding. */
async function seed(page, posts, principal = session) {
  await page.addInitScript(({ records, identity }) => {
    if (localStorage.getItem('writespace_posts') === null) {
      localStorage.setItem('writespace_posts', JSON.stringify(records));
      if (identity) localStorage.setItem('writespace_session', JSON.stringify(identity));
    }
  }, { records: posts, identity: principal });
}

test('guest list entry redirects to login and a public preview remains protected', async ({ page }) => {
  await seed(page, [post], null);
  await page.goto('/blogs');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await page.getByRole('link', { name: post.title, exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: post.title })).toHaveCount(0);
});

test('reads sorted local data, preserves safe full text on reload and returns via UI links', async ({ page }) => {
  const older = { ...post, id: 'older', title: 'Earlier thought', content: 'An earlier local note.', authorId: 'other', createdAt: '2026-03-01T12:00:00.000Z' };
  await seed(page, [older, post]);
  await page.goto('/');
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  const cards = page.getByRole('region', { name: 'Saved posts' }).getByRole('article');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0).getByRole('heading')).toHaveText(post.title);
  await expect(cards.nth(1).getByRole('heading')).toHaveText(older.title);
  await expect(cards.nth(0).getByRole('link', { name: `Edit ${post.title}` })).toBeVisible();
  await expect(cards.nth(1).getByRole('link', { name: /^Edit / })).toHaveCount(0);
  await page.getByRole('link', { name: `Read ${post.title}`, exact: true }).click();
  await expect(page).toHaveURL(/\/blog\/note-1$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(post.title);
  await expect(page.getByRole('article').getByText(`By ${post.authorName}`, { exact: true })).toBeVisible();
  await expect(page.getByRole('article').locator('time')).toHaveText('Mar 04, 2026');
  const body = page.getByRole('article').locator('.whitespace-pre-wrap');
  expect(await body.textContent()).toBe(post.content);
  await expect(body).toHaveCSS('white-space', 'pre-wrap');
  await expect(page.getByRole('article').locator('script, img')).toHaveCount(0);
  expect(await page.evaluate(() => window.readingInjected)).toBeUndefined();
  await page.reload();
  expect(await body.textContent()).toBe(post.content);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([older, post]);
  await expect(page.getByText(/Demo only: passwords are stored/)).toBeVisible();
  await page.getByRole('link', { name: 'Back to blogs' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await page.getByRole('link', { name: `Read ${older.title}` }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(older.title);
  await expect(page.getByRole('link', { name: 'Edit post' })).toHaveCount(0);
});

test('lays out a mobile single-column grid and tablet/desktop two/three columns', async ({ page }) => {
  await seed(page, [post, { ...post, id: 'second', title: 'Second note' }, { ...post, id: 'third', title: 'Third note' }]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
  const grid = page.getByRole('region', { name: 'Saved posts' });
  expect(await grid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 768, height: 1024 });
  expect(await grid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(2);
  await page.setViewportSize({ width: 1280, height: 900 });
  expect(await grid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(3);
});

test('empty list provides a Write CTA to its future route', async ({ page }) => {
  await seed(page, []);
  await page.goto('/');
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No posts yet', exact: true })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
  await page.getByRole('link', { name: 'Write a post' }).click();
  await expect(page).toHaveURL(/\/write$/);
});

test('missing post entry shows exact not-found and returns to the populated list', async ({ page }) => {
  await seed(page, [post]);
  await page.goto('/blog/missing');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Post not found');
  await expect(page.getByRole('link', { name: 'Edit post' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to blogs' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('heading', { name: post.title })).toBeVisible();
});
