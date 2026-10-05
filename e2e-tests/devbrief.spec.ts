import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('DevBrief', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/devbrief');
    await page.evaluate(() => localStorage.clear());
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.reload();
    await expect(page.getByText('Nothing here yet')).toBeVisible();
  });

  test('generates, copies, and downloads a structured issue brief', async ({ page }) => {
    await page.getByRole('button', { name: 'Search filters' }).click();
    await page.getByRole('button', { name: 'Generate brief' }).click();

    await expect(page.getByTestId('brief-panel').getByText('Brief generated')).toBeVisible();
    await expect(page.getByTestId('brief-section-problem')).toContainText(
      'The game search filter resets',
    );
    await expect(page.getByTestId('brief-section-implementation-steps')).toBeVisible();
    await expect(page.getByTestId('brief-section-testing-checklist')).toBeVisible();
    await expect(page.getByTestId('brief-panel').locator('article')).toHaveCount(10);

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download .md' }).click();
    expect((await download).suggestedFilename()).toBe(
      'the-game-search-filter-resets-when-i-open-a-game-and-use-the-browser.md',
    );
    await page.getByRole('button', { name: 'Copy full brief' }).click();
    await expect(page.getByTestId('toast')).toContainText('Full brief copied');
  });

  test('restores and deletes a brief from local history', async ({ page }) => {
    await page.getByRole('button', { name: 'Keyboard dialog' }).click();
    await page.getByRole('button', { name: 'Generate brief' }).click();

    const historyItem = page
      .getByRole('listitem')
      .filter({ hasText: /confirmation dialog cannot be dismissed/i });
    const savedBrief = historyItem.getByRole('button').first();
    await expect(savedBrief).toBeVisible();
    await page.getByRole('button', { name: 'Clear issue text' }).click();
    await savedBrief.click();
    await expect(page.getByLabel('Describe the issue to turn into a development brief')).toHaveValue(
      /confirmation dialog cannot be dismissed/i,
    );
    await historyItem.getByRole('button').nth(1).click();
    await expect(page.getByText('Nothing here yet')).toBeVisible();
  });

  test('retries saving history after a storage write fails', async ({ page }) => {
    const issueInput = page.getByLabel('Describe the issue to turn into a development brief');
    await issueInput.fill('First saved issue.');
    await page.getByRole('button', { name: 'Generate brief' }).click();
    await expect(page.getByRole('button', { name: 'Delete First saved issue' })).toBeVisible();

    await page.evaluate(() => {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'devbrief.history.v1') {
          Storage.prototype.setItem = originalSetItem;
          throw new DOMException('Storage is full.', 'QuotaExceededError');
        }
        originalSetItem.call(this, key, value);
      };
    });

    await issueInput.fill('Second saved issue.');
    await page.getByRole('button', { name: 'Generate brief' }).click();
    await expect(page.getByRole('alert')).toContainText('Browser storage is full');

    await page.getByRole('button', { name: 'Delete Second saved issue' }).click();
    await expect.poll(() =>
      page.evaluate(() => {
        const stored = window.localStorage.getItem('devbrief.history.v1');
        return stored ? JSON.parse(stored).map((brief: { issue: string }) => brief.issue) : [];
      }),
    ).toEqual(['First saved issue.']);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('supports keyboard shortcuts and accessible empty-issue feedback', async ({ page }) => {
    const issueInput = page.getByLabel('Describe the issue to turn into a development brief');
    await page.getByRole('button', { name: 'Generate brief' }).click();
    await expect(page.getByRole('alert')).toContainText('Add a few details');
    await issueInput.fill('Saving a project displays a stale name.');
    await issueInput.press('Control+Enter');
    await expect(page.getByTestId('brief-section-problem')).toContainText(
      'Saving a project displays a stale name.',
    );
    await page.keyboard.press('Escape');
    await expect(issueInput).toHaveValue('');
  });

  test('has no serious WCAG 2.1 AA accessibility violations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Search filters' }).click();
    await page.getByRole('button', { name: 'Generate brief' }).click();
    await expect(page.getByTestId('brief-section-problem')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
