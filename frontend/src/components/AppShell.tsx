import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { HostHeader } from './HostHeader';
import { TrialBanner } from './TrialBanner';
import { useDarkMode } from '../hooks/useDarkMode';
import { useUiStore } from '../stores/uiStore';
import dayjs, { RESTAURANT_TZ } from '../utils/dayjs';
import { cn } from '../lib/utils';

const ShellInner: React.FC = () => {
    const { dark, toggle } = useDarkMode();
    const { date, arrivalsNow, onQuickRes } = useUiStore((s) => s.header);
    const { pathname } = useLocation();
    const today = dayjs.tz(undefined, RESTAURANT_TZ).format('YYYY-MM-DD');
    // Floor-plan editor needs full height without page scroll; others scroll.
    const isEditor = pathname.startsWith('/app/floor-plan');
    const isLive = pathname.startsWith('/app/live') || pathname === '/app/dashboard';

    return (
        <div
            className={cn(
                'min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col',
                isLive || isEditor ? 'h-screen overflow-hidden' : null,
            )}
        >
            <div className="w-full max-w-[1600px] mx-auto flex flex-col flex-1 min-h-0 gap-4 p-3 lg:p-4">
                <div className="sticky top-0 z-40 -mx-1 px-1 pt-1 pb-2 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur">
                    <HostHeader
                        date={date ?? today}
                        arrivalsNow={arrivalsNow ?? 0}
                        onQuickRes={onQuickRes}
                        dark={dark}
                        onToggleDark={toggle}
                    />
                </div>
                <TrialBanner />
                <div className={cn('flex-1 min-h-0 flex flex-col', isLive || isEditor ? null : 'pb-10')}>
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

/**
 * Single app chrome for all /app pages: one HostHeader instance, mounted
 * once, updated via the UI store (no rebuild per route). Pages only render
 * their content and publish {date, arrivalsNow, onQuickRes}.
 */
export const AppShell: React.FC = () => <ShellInner />;
