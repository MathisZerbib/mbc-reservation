import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Map as MapIcon, List } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { cn } from '../lib/utils';

interface HostTabsProps {
    /** Selected day, carried into the tab links. */
    date: string;
    /** Live counter shown on the Planning tab (arriving + unseated). */
    arrivalsNow?: number;
}

/**
 * Shared switcher between the two host workspaces: full-width live map
 * and full-width arrivals list. Rendered on all screen sizes.
 */
export const HostTabs: React.FC<HostTabsProps> = ({ date, arrivalsNow = 0 }) => {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const onLive = pathname.startsWith('/app/live') || pathname === '/app/dashboard';

    const tab = (active: boolean) =>
        cn(
            "flex-1 h-11 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2",
            active ? "bg-slate-900 text-white shadow" : "text-slate-400 hover:text-slate-600",
        );

    return (
        <div className="flex bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl p-1 gap-1 shadow-sm">
            <Link to={`/app/live?date=${date}`} className={tab(onLive)} aria-current={onLive ? 'page' : undefined}>
                <MapIcon className="w-4 h-4" /> {t('dashboard.tabMap')}
            </Link>
            <Link to={`/app/planning?date=${date}`} className={tab(!onLive)} aria-current={!onLive ? 'page' : undefined}>
                <List className="w-4 h-4" /> {t('dashboard.tabList')}
                {arrivalsNow > 0 && (
                    <span className={cn(
                        "min-w-5 h-5 px-1 rounded-full text-[10px] font-black flex items-center justify-center tabular-nums",
                        !onLive ? "bg-indigo-500 text-white" : "bg-red-500 text-white",
                    )}>
                        {arrivalsNow}
                    </span>
                )}
            </Link>
        </div>
    );
};
