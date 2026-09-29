import type { APIRequestContext } from '@playwright/test';

export const API_BASE =
    process.env.E2E_API_URL || 'https://mbc-reservation.onrender.com/api';

/**
 * Render cold starts can take up to ~50s. Block the backend-dependent
 * suites until /health answers instead of failing on a sleeping server.
 *
 * The wait can outlast the default 90s test timeout, so callers must raise
 * it with `test.setTimeout` before awaiting this.
 */
export async function waitForBackend(
    request: APIRequestContext,
    timeoutMs = 100_000
): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        try {
            const res = await request.get(API_BASE.replace(/\/api$/, '') + '/health', {
                timeout: 15_000,
            });
            if (res.ok()) return;
        } catch {
            // still waking — retry below
        }
        if (Date.now() > deadline) {
            throw new Error(`Backend did not wake within ${Math.round(timeoutMs / 1000)}s`);
        }
        await new Promise(r => setTimeout(r, 3_000));
    }
}
