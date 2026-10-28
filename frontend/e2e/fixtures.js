/** Capture browser failures for every journey importing this fixture. */
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const errors = [];
    const onConsole = (message) => { if (message.type() === 'error') errors.push(message.text()); };
    const onPageError = (error) => { errors.push(error.message); };
    page.on('console', onConsole);
    page.on('pageerror', onPageError);
    try {
      await use(page);
    } finally {
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      await testInfo.attach('browser-errors', { body: JSON.stringify(errors, null, 2), contentType: 'application/json' });
      expect(errors, 'No console or uncaught browser errors').toEqual([]);
    }
  },
});

export { expect };
