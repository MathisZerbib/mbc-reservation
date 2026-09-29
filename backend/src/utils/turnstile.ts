/**
 * Cloudflare Turnstile server-side verification (canonical siteverify flow).
 *
 * Requires `success === true`, the expected per-surface `action`, and —
 * when TURNSTILE_HOSTNAMES is set — an approved frontend hostname.
 * The secret is read from TURNSTILE_SECRET (canonical) with fallback to
 * TURNSTILE_SECRET_KEY. Without any secret (local dev) verification is
 * bypassed with a warning — same mock-pattern as the email service.
 */
export interface TurnstileCheck {
    token: string | undefined;
    remoteIp?: string;
    /** Per-surface action rendered into the widget (e.g. "signup", "booking"). */
    expectedAction: string;
}

const expectedHostnames = (): Set<string> =>
    new Set(
        (process.env.TURNSTILE_HOSTNAMES ?? '')
            .split(',')
            .map(h => h.trim().toLowerCase())
            .filter(Boolean),
    );

export async function verifyTurnstile({ token, remoteIp, expectedAction }: TurnstileCheck): Promise<boolean> {
    const secret = process.env.TURNSTILE_SECRET || process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
        console.warn('[turnstile] no secret set — skipping verification (dev only)');
        return true;
    }
    if (typeof token !== 'string' || token.length === 0 || token.length > 2048) return false;

    let result: { success?: boolean; action?: string; hostname?: string };
    try {
        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            signal: AbortSignal.timeout(10_000),
            body: new URLSearchParams({
                secret,
                response: token,
                ...(remoteIp ? { remoteip: remoteIp } : {}),
            }),
        });
        if (!res.ok) throw new Error(`siteverify ${res.status}`);
        result = (await res.json()) as typeof result;
    } catch (e) {
        console.error('[turnstile] siteverify failed:', e);
        return false;
    }

    if (result.success !== true) return false;
    if (result.action !== expectedAction) {
        console.warn(`[turnstile] action mismatch: got "${result.action}", want "${expectedAction}"`);
        return false;
    }
    const allowed = expectedHostnames();
    if (allowed.size > 0) {
        const hostname = (result.hostname ?? '').toLowerCase();
        if (!allowed.has(hostname)) {
            console.warn(`[turnstile] hostname not allowed: "${result.hostname}"`);
            return false;
        }
    } else {
        console.warn('[turnstile] TURNSTILE_HOSTNAMES not set — skipping hostname check (set it in production)');
    }
    return true;
}
