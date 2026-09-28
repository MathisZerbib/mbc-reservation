import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Only run source tests — never the compiled copies that `tsc` drops in dist/.
        include: ['src/**/*.test.ts'],
        // DB-touching suites (bookingIntegration, logicalBooking) are opt-in via
        // RUN_DB_TESTS=1 so a plain `npm test` can never wipe a real database.
    },
});