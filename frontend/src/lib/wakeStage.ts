import type { TranslationKey } from '../i18n/useTranslation';

const STAGE_THRESHOLDS = { connecting: 18, waking: 62 } as const;

/**
 * Copy stage for a cold-start estimate, so a long wait has visible
 * milestones instead of a frozen screen.
 */
export function wakeStageKey(progress: number, degraded: boolean): TranslationKey {
    if (degraded) return 'server.unreachable';
    if (progress < STAGE_THRESHOLDS.connecting) return 'landing.wake.connecting';
    if (progress < STAGE_THRESHOLDS.waking) return 'landing.wake.waking';
    return 'landing.wake.almost';
}
