import { defineConfig } from '@playwright/test';

/**
 * End-to-end suite. Production-safe by design: only page renders,
 * client-side validation paths, and read-only / 4xx API probes.
 * Nothing here creates tenants, bookings, or users.
 *
 * Override targets for local runs:
 *   E2E_BASE_URL=http://localhost:5173 E2E_API_URL=http://localhost:3000/api
 */
export default defineConfig({
    testDir: './e2e',
    testMatch: '**/*.spec.ts',
    timeout: 90_000,
    fullyParallel: true,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL: process.env.E2E_BASE_URL || 'https://mbc-reservation.vercel.app',
        trace: 'retain-on-failure',
    },
    projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
