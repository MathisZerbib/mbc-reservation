import { test, expect } from '@playwright/test';
import { API_BASE, waitForBackend } from './helpers';

test.describe('public booking (read-only probes)', () => {
    test.beforeEach(async ({ request }) => {
        await waitForBackend(request);
    });
    test('/book redirects to the default restaurant page', async ({ page }) => {
        await page.goto('/book');
        await expect(page).toHaveURL(/\/b\/[^/]+$/);
    });

    test('restaurant booking page renders the widget', async ({ page }) => {
        await page.goto('/b/mbc');
        await expect(page.getByText(/book a table|réserver/i).first()).toBeVisible({ timeout: 60_000 });
    });

    test('availability API requires a slug and rejects unknown ones', async ({ request }) => {
        const missing = await request.get(`${API_BASE}/availability?date=2026-10-05&time=19:00&size=2`, {
            timeout: 60_000,
        });
        expect(missing.status()).toBe(400);

        const unknown = await request.get(
            `${API_BASE}/availability?date=2026-10-05&time=19:00&size=2&slug=no-such-restaurant`,
            { timeout: 60_000 },
        );
        expect(unknown.status()).toBe(404);

        const known = await request.get(`${API_BASE}/daily-availability?date=2026-10-05&size=2&slug=mbc`, {
            timeout: 60_000,
        });
        expect(known.status()).toBe(200);
        expect(await known.json()).toBeInstanceOf(Array);
    });

    test('backend health is reachable', async ({ request }) => {
        const res = await request.get(API_BASE.replace(/\/api$/, '') + '/health', { timeout: 60_000 });
        expect([200, 503]).toContain(res.status());
    });
});
