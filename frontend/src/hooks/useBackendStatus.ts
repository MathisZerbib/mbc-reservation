import { useEffect, useRef, useState } from 'react';
import { healthUrl } from '../services/api';

export type BackendStatus = 'checking' | 'waking' | 'ready' | 'degraded';

// Below this, the health probe is considered an ordinary in-flight request:
// callers show nothing rather than flashing a loading state for a server that
// answers in a few hundred milliseconds.
const WAKE_THRESHOLD_MS = 3000;
const DISPLAY_CAP = 90;
const TIME_CONSTANT_MS = 15_000;

/**
 * Detects Render cold starts. /health normally answers in well under a
 * second, so nothing should be shown to the visitor for that. Only once it
 * has been silent for WAKE_THRESHOLD_MS does the status become 'waking' and
 * `isWaiting` turn true, with an eased 0→90% estimate that only completes
 * when /health actually answers.
 */
export function useBackendWake(): {
    status: BackendStatus;
    progress: number;
    /** True only once the wait is long enough to be worth explaining. */
    isWaiting: boolean;
} {
    const [status, setStatus] = useState<BackendStatus>('checking');
    const [progress, setProgress] = useState(0);
    // One clock per wake attempt. The status flips checking → waking halfway
    // through, and restarting the estimate there made the bar jump backwards.
    const startedAt = useRef<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        const wakeTimer = window.setTimeout(() => {
            if (!cancelled) setStatus(prev => (prev === 'checking' ? 'waking' : prev));
        }, WAKE_THRESHOLD_MS);

        fetch(healthUrl(), { cache: 'no-store' })
            .then(async res => {
                if (cancelled) return;
                if (!res.ok) {
                    setStatus('degraded');
                    return;
                }
                const body = (await res.json().catch(() => ({}))) as { status?: string };
                setStatus(body.status === 'ok' ? 'ready' : 'degraded');
            })
            .catch(() => {
                if (!cancelled) setStatus('waking');
            })
            .finally(() => window.clearTimeout(wakeTimer));

        return () => {
            cancelled = true;
            window.clearTimeout(wakeTimer);
        };
    }, []);

    useEffect(() => {
        if (status === 'ready' || status === 'degraded') {
            startedAt.current = null;
            return;
        }
        startedAt.current ??= Date.now();
        const since = startedAt.current;
        const timer = window.setInterval(() => {
            const elapsed = Date.now() - since;
            setProgress(Math.min(DISPLAY_CAP, Math.round(DISPLAY_CAP * (1 - Math.exp(-elapsed / TIME_CONSTANT_MS)))));
        }, 500);
        return () => window.clearInterval(timer);
    }, [status]);

    const isWaiting = status === 'waking' || status === 'degraded';
    return { status, progress: status === 'ready' ? 100 : progress, isWaiting };
}

/** Status-only accessor. */
export function useBackendStatus(): BackendStatus {
    return useBackendWake().status;
}
