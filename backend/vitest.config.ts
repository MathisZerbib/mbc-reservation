import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        setupFiles: ['./src/tests/setup.ts'],
        exclude: ['**/node_modules/**', '**/dist/**'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            include: ['src/**/*.ts'],
            exclude: [
                'src/**/*.test.ts',
                'src/tests/**',
                'src/scripts/**',
                'src/seed.ts',
                'src/docs/**',
                'src/types/**',
            ],
            thresholds: {
                lines: 20,
                functions: 20,
                branches: 18,
                statements: 20,
            },
        },
    },
});
