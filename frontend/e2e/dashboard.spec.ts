import { test, expect } from '@playwright/test';
import { waitForBackend } from './helpers';

/**
 * Signed-in smoke via the sandbox demo account. Creates no data: it only
 * loads the authenticated app and asserts the surface that rendered.
 */
test.describe('demo app smoke', () => {
    test.beforeEach(async ({ request }) => {
        test.setTimeout(150_000);
        await waitForBackend(request);
    });

    test('demo login lands on the app', async ({ page }) => {
        await page.goto('/login');
        await page.getByRole('button', { name: /demo|démo/i }).click();

        // Login hands over to /app/dashboard for ~2s before the onboarding
        // gate can bounce an un-onboarded tenant to /onboarding, so a bare URL
        // check passes even when the app ends up elsewhere. Wait for the app
        // to settle, then assert where it really landed.
        await expect(page).not.toHaveURL(/\/login$/, { timeout: 60_000 });
        await page.waitForTimeout(4_000);
        // The dashboard mirrors its selected date into the query string, so
        // match the path and let a trailing `?date=…` through — anchoring on
        // `$` raced that effect and failed intermittently.
        await expect(page).toHaveURL(/\/(app\/(live|planning|dashboard)|onboarding)(\?|$)/);

        // The live map is the target, but the onboarding gate is legitimate
        // behaviour driven by the sandbox tenant's state — assert whichever
        // surface rendered, not a transient URL.
        if (/\/onboarding(\?|$)/.test(page.url())) {
            await expect(page.getByRole('heading', { level: 1 })).toContainText('Faci-Table');
            return;
        }
        // Host workspace tabs: live map + planning.
        await expect(page.getByRole('link', { name: /carte|map/i }).first()).toBeVisible({
            timeout: 30_000,
        });
        await expect(page.getByRole('link', { name: /arrivées|arrivals/i }).first()).toBeVisible();
        await expect(page.getByTitle(/analyses|analytics/i)).toBeVisible();
        await expect(page.getByTitle(/réglages|settings/i)).toBeVisible();
    });
});
