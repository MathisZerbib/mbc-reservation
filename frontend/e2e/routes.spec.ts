import { test, expect } from '@playwright/test';

test.describe('landing and public routes', () => {
    test('landing renders on / with trial + login entry points', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.getByRole('link', { name: /essai gratuit|start free trial/i })).toHaveAttribute(
            'href',
            '/register',
        );
        await expect(page.getByRole('link', { name: /espace manager|manager area/i })).toHaveAttribute(
            'href',
            '/login',
        );
    });

    test('/login and /register render their forms', async ({ page }) => {
        await page.goto('/login');
        await expect(page.getByLabel('Login form')).toBeVisible();
        await page.goto('/register');
        await expect(page.getByLabel('Registration form')).toBeVisible();
    });

    test('unknown paths show the 404 page', async ({ page }) => {
        await page.goto('/nope/not-a-route');
        await expect(page.getByText('404')).toBeVisible();
    });

    test('reserved words are not treated as restaurants', async ({ page }) => {
        await page.goto('/landing');
        await expect(page.getByText('404')).toBeVisible();
    });

    test('protected app redirects to login when signed out', async ({ page }) => {
        await page.goto('/app/dashboard');
        await expect(page).toHaveURL(/\/login$/);
        await page.goto('/onboarding');
        await expect(page).toHaveURL(/\/login$/);
    });

    test('landing locks the widget with progress while the backend wakes', async ({ page }) => {
        await page.route('**/health', async route => {
            await new Promise(r => setTimeout(r, 12_000));
            await route.continue();
        });
        await page.goto('/');
        // Lock is up while the backend is unreachable…
        await expect(page.getByText(/débloque|unlocks/i)).toBeVisible({ timeout: 25_000 });
        await expect(page.getByText(/%$/)).toBeVisible();
        // …and lifts once /health finally answers.
        await expect(page.getByText(/débloque|unlocks/i)).toBeHidden({ timeout: 30_000 });
    });

    test('a healthy backend shows no loading state at all', async ({ page }) => {
        // /health answers immediately: neither the landing widget nor the
        // login notice may show a progress bar, even for a frame.
        await page.goto('/');
        await expect(page.getByRole('progressbar')).toHaveCount(0);
        await expect(page.getByText(/débloque|unlocks/i)).toHaveCount(0);
        // Give the probe time to resolve and settle, then check again.
        await page.waitForTimeout(4_000);
        await expect(page.getByRole('progressbar')).toHaveCount(0);
        await expect(page.getByText(/débloque|unlocks/i)).toHaveCount(0);

        await page.goto('/login');
        await page.waitForTimeout(4_000);
        await expect(page.getByRole('progressbar')).toHaveCount(0);
        await expect(page.getByText(/réveil du serveur|waking/i)).toHaveCount(0);
        // The form is usable straight away.
        await expect(page.getByLabel(/email/i)).toBeVisible();
    });
});
