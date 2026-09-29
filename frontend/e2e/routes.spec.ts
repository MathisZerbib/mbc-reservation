import { test, expect } from '@playwright/test';

test.describe('landing and public routes', () => {
    test('landing renders on / with trial + login entry points', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.getByRole('link', { name: /essai gratuit|start free trial/i })).toHaveAttribute(
            'href',
            '/register',
        );
        await expect(page.getByRole('link', { name: /ouvrir l'app|open the app/i })).toHaveAttribute(
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
});
