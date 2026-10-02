import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import dayjs, { RESTAURANT_TZ } from '../utils/dayjs';
import { Analytics } from './Analytics';
import { RangeAnalytics } from './RangeAnalytics';
import { useTranslation } from '../i18n/useTranslation';
import { useUiStore } from '../stores/uiStore';
import { cn } from '../lib/utils';

type Period = 'day' | 'week' | 'month' | 'year';

/**
 * Chef's view: daily pilotage (bookings, turnover, peak, occupancy,
 * per-hour breakdown). Lives on its own route so the host dashboard
 * stays a pure live-ops surface with maximum room for the map.
 */
export const AnalyticsPage: React.FC = () => {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const date = searchParams.get('date') || dayjs.tz(undefined, RESTAURANT_TZ).format('YYYY-MM-DD');
    const [period, setPeriod] = useState<Period>('day');
    const setHeaderConfig = useUiStore((s) => s.setHeader);
    useEffect(() => {
        setHeaderConfig({ date, arrivalsNow: 0, onQuickRes: undefined });
    }, [date, setHeaderConfig]);

    const range = useMemo(() => {
        const to = date;
        if (period === 'week') return { from: dayjs(to).subtract(6, 'day').format('YYYY-MM-DD'), to };
        if (period === 'month') return { from: dayjs(to).subtract(29, 'day').format('YYYY-MM-DD'), to };
        return { from: dayjs(to).startOf('year').format('YYYY-MM-DD'), to };
    }, [period, date]);

    const tabs: { id: Period; label: string }[] = [
        { id: 'day', label: t('range.day') },
        { id: 'week', label: t('range.week') },
        { id: 'month', label: t('range.month') },
        { id: 'year', label: t('range.year') },
    ];

    return (
        <div className="w-full max-w-[1200px] mx-auto flex flex-col gap-4">
                <div className="flex gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-1.5 w-fit">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setPeriod(tab.id)}
                            className={cn(
                                "h-9 px-4 rounded-xl text-xs font-black transition-all cursor-pointer",
                                period === tab.id
                                    ? "bg-slate-900 dark:bg-white dark:text-slate-900 text-white shadow"
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white",
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                {period === 'day' ? (
                    <Analytics date={date} />
                ) : (
                    <RangeAnalytics from={range.from} to={range.to} />
                )}
        </div>
    );
};
