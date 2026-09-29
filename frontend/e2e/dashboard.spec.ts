import { test, expect } from '@playwright/test';
import { waitForBackend } from './helpers';

/**
 * Signed-in smoke via the sandbox demo account. Creates no data:
 * it only loads the dashboard and asserts the shell renders.
 */
test.describe('demo dashboard smoke', () => {
    test.beforeEach(async ({ request }) => {
        await waitForBackend(request);
    });

    test('demo login lands on the dashboard', async ({ page }) => {
        await page.goto('/login');
        await page.getByRole('button', { name: /demo|démo/i }).click();
        await expect(page).toHaveURL(/\/app\/dashboard$/, { timeout: 60_000 });
        await expect(page.getByText(/faci-table/i).first()).toBeVisible({ timeout: 30_000 });
    });
});
