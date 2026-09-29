import React from 'react';
import { cn } from '../lib/utils';

/**
 * Determinate progress bar for Render cold starts.
 *
 * No spinner: the bar reports a believable estimate (asymptotic, it never
 * claims 100% before /health actually answers) and the copy advances with it,
 * so a 40s cold start reads as progress rather than a frozen screen.
 */
export type WakeProgressProps = {
    /** 0–100. Clamped and rounded. */
    progress: number;
    /** Stage line above the bar, e.g. "Waking the server…". */
    label: string;
    /** Pre-formatted percentage, e.g. "62 %". */
    percentLabel: string;
    className?: string;
    tone?: 'dark' | 'light';
};

export const WakeProgress: React.FC<WakeProgressProps> = ({
    progress,
    label,
    percentLabel,
    className,
    tone = 'dark',
}) => {
    const value = Math.max(0, Math.min(100, Math.round(progress)));
    const light = tone === 'light';

    return (
        <div className={cn('w-full', className)}>
            <div className="mb-2.5 flex items-baseline justify-between gap-4">
                <span
                    className={cn(
                        'truncate text-xs font-bold tracking-wide',
                        light ? 'text-slate-600' : 'text-white/90'
                    )}
                >
                    {label}
                </span>
                <span
                    className={cn(
                        'shrink-0 text-[11px] font-black tabular-nums',
                        light ? 'text-slate-500' : 'text-white/60'
                    )}
                >
                    {percentLabel}
                </span>
            </div>

            <div
                role="progressbar"
                aria-valuenow={value}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={label}
                className={cn(
                    'relative h-1.5 w-full overflow-hidden rounded-full',
                    light ? 'bg-slate-900/10 ring-1 ring-inset ring-slate-900/10' : 'bg-white/15 ring-1 ring-inset ring-white/15'
                )}
            >
                <div
                    className={cn(
                        'absolute inset-y-0 left-0 rounded-full',
                        light ? 'bg-indigo-600' : 'bg-indigo-400',
                        'transition-[width] duration-700 ease-out motion-reduce:transition-none'
                    )}
                    style={{ width: `${value}%` }}
                />
            </div>
        </div>
    );
};
