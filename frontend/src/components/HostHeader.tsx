import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, ChartColumn, Sun, Moon, LogOut } from 'lucide-react';
import dayjs, { RESTAURANT_TZ } from '../utils/dayjs';
import { useTranslation } from '../i18n/useTranslation';
import { useSocketStatus } from '../services/socket';
import { clearSession } from '../utils/auth';
import { clearUserRole } from '../hooks/useUserRole';
import { HostTabs } from './HostTabs';

interface HostHeaderProps {
    /** Selected day (YYYY-MM-DD). Defaults to today (settings has no day). */
    date?: string;
    /** Live counter on the Planning tab. Defaults to 0 (hidden badge). */
    arrivalsNow?: number;
    /** When provided, shows the quick-résa button (live page). */
    onQuickRes?: () => void;
    /** Dark mode on/off (moon/sun toggle). */
    dark?: boolean;
    onToggleDark?: () => void;
}

/**
 * Shared header for the host workspaces: title + day, workspace tabs,
 * and the global actions. One inset scale everywhere.
 * Memoized + rendered once by AppShell (props update, never remounts).
 */
export const HostHeader: React.FC<HostHeaderProps> = React.memo(({ date = dayjs.tz(undefined, RESTAURANT_TZ).format('YYYY-MM-DD'), arrivalsNow = 0, onQuickRes, dark = false, onToggleDark }) => {
    const { t } = useTranslation();
    const live = useSocketStatus();
    const navigate = useNavigate();

    const logout = () => {
        clearSession();
        clearUserRole();
        navigate('/login', { replace: true });
    };

    return (
        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 flex-none">
            <div>
                <h1 className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none flex items-center gap-2">
                    Faci<span className="text-indigo-500">-</span>Table
                    <span
                        title={live ? t('dashboard.liveOn') : t('dashboard.liveOff')}
                        className={live ? "w-2 h-2 rounded-full bg-emerald-500" : "w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 animate-pulse"}
                    />
                </h1>
                <p className="text-slate-500 dark:text-slate-400 font-bold text-xs lg:text-sm mt-1">
                    {dayjs.tz(date, RESTAURANT_TZ).format('dddd, D MMM YYYY')}
                </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full xl:w-auto">
                <div className="flex-1 sm:flex-none sm:min-w-80">
                    <HostTabs date={date} arrivalsNow={arrivalsNow} />
                </div>
                <div className="flex gap-2">
                    {onQuickRes && (
                        <button
                            onClick={onQuickRes}
                            className="flex-1 sm:flex-none bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 text-white px-4 lg:px-6 h-12 rounded-2xl font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-sm"
                        >
                            <span className="text-lg font-black leading-none">+</span> <span>{t('dashboard.quickRes')}</span>
                        </button>
                    )}
                    {onToggleDark && (
                        <button
                            onClick={onToggleDark}
                            title={t('dashboard.darkTitle')}
                            className="min-w-[48px] min-h-[48px] p-3 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm text-slate-500 dark:text-amber-300 hover:text-slate-900 dark:hover:text-amber-200 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                        >
                            {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>
                    )}
                    <Link
                        to={`/app/analytics?date=${date}`}
                        className="min-w-[48px] min-h-[48px] p-3 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white active:scale-95 transition-all flex items-center justify-center"
                        title={t('dashboard.analyticsTitle')}
                    >
                        <ChartColumn className="w-5 h-5" />
                    </Link>
                    <Link
                        to="/app/settings"
                        className="min-w-[48px] min-h-[48px] p-3 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white active:scale-95 transition-all flex items-center justify-center"
                        title={t('dashboard.settingsTitle')}
                    >
                        <SettingsIcon className="w-5 h-5" />
                    </Link>
                    <button
                        onClick={logout}
                        title={t('dashboard.logoutTitle')}
                        aria-label={t('dashboard.logoutTitle')}
                        className="min-w-[48px] min-h-[48px] p-3 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm text-slate-500 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </header>
    );
});

HostHeader.displayName = 'HostHeader';
