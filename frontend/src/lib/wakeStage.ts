import type { TranslationKey } from '../i18n/useTranslation';

const ALMOST_READY_AT = 62;

/**
 * Copy stage for a cold-start estimate, so a long wait has visible
 * milestones instead of a frozen screen. This UI only appears once the
 * wait has already proved long, so it never claims to be connecting.
 */
export function wakeStageKey(progress: number, degraded: boolean): TranslationKey {
    if (degraded) return 'server.unreachable';
    return progress < ALMOST_READY_AT ? 'landing.wake.waking' : 'landing.wake.almost';
}
