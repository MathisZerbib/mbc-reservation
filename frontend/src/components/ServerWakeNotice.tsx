import React from 'react';
import { Loader2, CloudOff } from 'lucide-react';
import { useBackendStatus } from '../hooks/useBackendStatus';
import { useTranslation } from '../i18n/useTranslation';
import { cn } from '../lib/utils';

/**
 * Slim banner shown while the Render backend is cold-starting
 * (up to ~50s). Renders nothing once the backend answers.
 */
export const ServerWakeNotice: React.FC<{ className?: string }> = ({ className }) => {
    const status = useBackendStatus();
    const { t } = useTranslation();
    if (status === 'ready') return null;

    return (
        <div
            role="status"
            className={cn(
                "flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-2xl text-xs font-bold border",
                status === 'degraded'
                    ? "bg-red-50 text-red-600 border-red-200"
                    : "bg-amber-50 text-amber-700 border-amber-200",
                className,
            )}
        >
            {status === 'degraded' ? (
                <><CloudOff className="w-4 h-4 shrink-0" /> {t('server.unreachable')}</>
            ) : (
                <><Loader2 className="w-4 h-4 shrink-0 animate-spin" /> {t('server.waking')}</>
            )}
        </div>
    );
};
