import React from 'react';
import { CloudOff } from 'lucide-react';
import { useBackendWake } from '../hooks/useBackendStatus';
import { WakeProgress } from './WakeProgress';
import { wakeStageKey } from '../lib/wakeStage';
import { useTranslation } from '../i18n/useTranslation';
import { cn } from '../lib/utils';

/**
 * Slim banner shown only when the Render backend is genuinely cold-starting
 * (up to ~50s). A determinate bar with staged copy, capped at 90%, so the
 * wait reads as progress; it only completes when /health actually answers.
 *
 * Renders nothing while the health probe is still in flight: on a warm
 * server this banner must never appear, not even for a frame.
 */
export const ServerWakeNotice: React.FC<{ className?: string }> = ({ className }) => {
    const { status, progress, isWaiting } = useBackendWake();
    const { t } = useTranslation();

    if (!isWaiting) return null;
    const degraded = status === 'degraded';

    return (
        <div
            role="status"
            className={cn(
                "px-4 py-3 rounded-2xl text-xs font-bold border",
                degraded
                    ? "border-red-200 text-red-600"
                    : "border-amber-200 text-amber-700",
                className,
            )}
        >
            {degraded ? (
                <div className="flex items-center justify-center gap-2.5">
                    <CloudOff className="w-4 h-4 shrink-0" aria-hidden="true" />
                    {t('server.unreachable')}
                </div>
            ) : (
                <WakeProgress
                    tone="light"
                    progress={progress}
                    label={t(wakeStageKey(progress, false))}
                    percentLabel={t('server.warming').replace('{n}', String(progress))}
                />
            )}
        </div>
    );
};
