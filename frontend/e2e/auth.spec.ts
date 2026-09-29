import { test, expect } from '@playwright/test';
import { API_BASE, waitForBackend } from './helpers';

test.describe('auth validation (no writes)', () => {
    test.beforeEach(async ({ request }) => {
        test.setTimeout(150_000);
        await waitForBackend(request);
    });

    test('register gates submit on bot verification', async ({ page }) => {
        await page.goto('/register');
        await expect(page.getByLabel(/restaurant/i)).toBeVisible();
        await page.getByLabel(/restaurant/i).fill('E2E Bistro');
        await page.locator('input[type="email"]').fill('e2e@example.com');
        await page.locator('input[type="password"]').fill('supersecurepassword123');
        // Submit stays disabled until the Turnstile challenge is solved.
        await expect(page.getByRole('button', { name: /create|créer/i })).toBeDisabled();
    });

    test('login with wrong credentials shows an error @budget', async ({ page }) => {
        await page.goto('/login');
        await page.locator('input[type="email"]').fill('nobody-e2e@example.com');
        await page.locator('input[type="password"]').fill('wrong-password-123');
        await page.getByRole('button', { name: /^login|se connecter$/i }).click();
        await expect(page.locator('form').getByText(/invalid|invalide|verify|vérifi/i)).toBeVisible({
            timeout: 60_000,
        });
    });

    test('register API rejects missing bot token @budget', async ({ request }) => {
        const res = await request.post(`${API_BASE}/auth/register`, {
            data: {
                email: 'bot-e2e@example.com',
                password: 'supersecurepassword123',
                restaurantName: 'Bot Bistro',
            },
            timeout: 60_000,
        });
        expect(res.status()).toBe(400);
    });
});
