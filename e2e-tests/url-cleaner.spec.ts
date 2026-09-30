import { expect, test } from '@playwright/test';

test.describe('URL tracking cleaner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/url-cleaner');
  });

  test('is reachable from the site navigation', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Toggle menu' }).click();
    await page.getByRole('link', { name: 'URL cleaner' }).click();

    await expect(page).toHaveURL(/\/url-cleaner$/);
    await expect(page.getByRole('heading', { name: 'URL tracking cleaner' })).toBeVisible();
  });

  test('lets users review tracking parameters, restore one, and copy the result', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByLabel('URL to clean').fill(
      'https://example.com/watch?v=abc&si=share-token&utm_source=mail&state=map#section',
    );

    const cleanedUrl = page.getByLabel('Result preview');
    const shareParameter = page.getByTestId('remove-candidate-1');
    const campaignParameter = page.getByTestId('remove-candidate-2');

    await expect(shareParameter).toBeChecked();
    await expect(campaignParameter).toBeChecked();
    await expect(cleanedUrl).toHaveValue(
      'https://example.com/watch?v=abc&state=map#section',
    );

    await shareParameter.uncheck();
    await expect(cleanedUrl).toHaveValue(
      'https://example.com/watch?v=abc&si=share-token&state=map#section',
    );
    await shareParameter.check();
    await expect(cleanedUrl).toHaveValue(
      'https://example.com/watch?v=abc&state=map#section',
    );

    await page.getByRole('button', { name: 'Copy cleaned URL' }).click();
    await expect(page.getByRole('status').last()).toContainText('copied to the clipboard');
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe('https://example.com/watch?v=abc&state=map#section');
  });

  test('shows unchanged and invalid URL states', async ({ page }) => {
    await page.getByLabel('URL to clean').fill('https://example.com/search?q=games&state=active');
    await expect(page.getByTestId('url-status')).toContainText(
      'No recognized tracking parameters found',
    );
    await expect(page.getByLabel('Result preview')).toHaveValue(
      'https://example.com/search?q=games&state=active',
    );

    await page.getByLabel('URL to clean').fill('not a URL');
    await expect(page.getByRole('alert')).toContainText('Enter a complete, valid');
    await expect(page.getByLabel('Result preview')).toHaveCount(0);
  });
});
