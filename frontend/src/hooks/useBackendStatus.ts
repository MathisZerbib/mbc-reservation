import { useEffect, useState } from 'react';
import { healthUrl } from '../services/api';

export type BackendStatus = 'checking' | 'waking' | 'ready' | 'degraded';

const WAKE_THRESHOLD_MS = 8000;

/**
 * Detects Render cold starts: if /health doesn't answer within a few
 * seconds the backend is still waking (up to ~50s) and callers should
 * tell the user instead of showing a dead form.
 */
export function useBackendStatus(): BackendStatus {
    const [status, setStatus] = useState<BackendStatus>('checking');

    useEffect(() => {
        let cancelled = false;
        const timer = window.setTimeout(() => {
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
            .finally(() => window.clearTimeout(timer));

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, []);

    return status;
}
