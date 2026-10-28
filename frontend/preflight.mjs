/** Capture representative UI states as text evidence and reviewer screenshots. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const root = 'preflight';
await mkdir(root, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';

/** Persist rendered text, style and landmark evidence for one state. */
async function capture(name) {
  await page.screenshot({ path: `${root}/${name}.png`, fullPage: true });
  await writeFile(`${root}/${name}.html`, await page.content());
  const accessibility = await page.accessibility.snapshot({ interestingOnly: false });
  const styles = await page.evaluate(() => ({
    fontFamily: getComputedStyle(document.body).fontFamily,
    headings: [...document.querySelectorAll('h1,h2,h3')].map((element) => ({
      text: element.textContent, font: getComputedStyle(element).fontFamily,
      size: getComputedStyle(element).fontSize,
    })),
    overflow: document.documentElement.scrollWidth > innerWidth,
    title: document.title,
  }));
  await writeFile(`${root}/${name}.json`, JSON.stringify({ accessibility, styles, errors }, null, 2));
  console.log(name, JSON.stringify(styles));
}

await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(base);
await capture('desktop-empty');
await page.setViewportSize({ width: 375, height: 812 });
await page.getByRole('button', { name: 'Open menu' }).click();
await capture('mobile-menu');
await page.getByRole('link', { name: 'Login', exact: true }).click();
await page.getByRole('button', { name: 'Login', exact: true }).click();
await capture('mobile-login-error');
await page.getByLabel('Username', { exact: true }).fill('admin');
await page.getByLabel('Password', { exact: true }).fill('admin');
await page.getByRole('button', { name: 'Login', exact: true }).click();
await page.getByRole('heading', { name: 'Admin dashboard', exact: true }).waitFor();
await page.setViewportSize({ width: 1280, height: 900 });
await page.getByRole('navigation', { name: 'Account navigation' }).getByRole('link', { name: 'Users', exact: true }).click();
await capture('desktop-users');
await page.setViewportSize({ width: 390, height: 844 });
await capture('mobile-users');
await browser.close();
if (errors.length) throw new Error(JSON.stringify(errors));
