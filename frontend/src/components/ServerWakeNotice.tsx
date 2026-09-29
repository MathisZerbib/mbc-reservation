import React from 'react';
import { Loader2, CloudOff } from 'lucide-react';
import { useBackendWake } from '../hooks/useBackendStatus';
import { useTranslation } from '../i18n/useTranslation';
import { cn } from '../lib/utils';

/**
 * Slim banner shown while the Render backend is cold-starting
 * (up to ~50s). Shows an eased progress estimate capped at 90% —
 * it only hits 100% when /health actually answers — then disappears.
 */
export const ServerWakeNotice: React.FC<{ className?: string }> = ({ className }) => {
    const { status, progress } = useBackendWake();
    const { t } = useTranslation();

    if (status === 'ready') return null;

    return (
        <div
            role="status"
            className={cn(
                "flex flex-col gap-2 px-4 py-3 rounded-2xl text-xs font-bold border",
                status === 'degraded'
                    ? "bg-red-50 text-red-600 border-red-200"
                    : "bg-amber-50 text-amber-700 border-amber-200",
                className,
            )}
        >
            <div className="flex items-center justify-center gap-2.5">
                {status === 'degraded' ? (
                    <><CloudOff className="w-4 h-4 shrink-0" /> {t('server.unreachable')}</>
                ) : (
                    <><Loader2 className="w-4 h-4 shrink-0 animate-spin" /> {t('server.waking')}</>
                )}
            </div>
            {status !== 'degraded' && (
                <div className="flex items-center gap-2.5" aria-hidden="true">
                    <div className="flex-1 h-1.5 rounded-full bg-amber-900/10 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-amber-500 transition-[width] duration-500 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <span className="tabular-nums text-[11px] w-9 text-right">
                        {t('server.warming').replace('{n}', String(progress))}
                    </span>
                </div>
            )}
        </div>
    );
};
