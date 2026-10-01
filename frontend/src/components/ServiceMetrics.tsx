import React, { useMemo } from 'react';
import { Users, Armchair, Clock3, Timer } from 'lucide-react';
import dayjs, { RESTAURANT_TZ } from '../utils/dayjs';
import { useRestaurantSettings, useLayoutTables } from '../hooks/useFloorPlan';
import { useTranslation } from '../i18n/useTranslation';
import { cn } from '../lib/utils';
import type { Booking } from '../types';

interface ServiceMetricsProps {
    bookings: Booking[];
    date: string;
}

/**
 * Live service strip for the host: seated covers, engaged tables,
 * arrivals in the next 15 minutes, and tables overstaying their slot.
 * Purely derived — no backend calls.
 */
export const ServiceMetrics: React.FC<ServiceMetricsProps> = ({ bookings, date }) => {
    const { t } = useTranslation();
    const { settings } = useRestaurantSettings();
    const { raw: layoutTables } = useLayoutTables();
    const turnover = settings?.tableTurnoverMinutes ?? 105;

    const m = useMemo(() => {
        const now = dayjs();
        const day = bookings.filter(
            b => dayjs(b.startTime).tz(RESTAURANT_TZ).format('YYYY-MM-DD') === date && b.status !== 'CANCELLED',
        );
        const seated = day.filter(b => b.status === 'COMPLETED' && !b.leftAt && dayjs(b.endTime).isAfter(now));
        const seatedCovers = seated.reduce((s, b) => s + b.size, 0);
        const totalCovers = day.reduce((s, b) => s + b.size, 0);
        const tablesNow = new Set(seated.flatMap(b => (b.tables ?? []).map(x => x.name)));
        const totalTables = layoutTables.length;
        const next = day.filter(b => {
            if (b.status !== 'PENDING' && b.status !== 'CONFIRMED') return false;
            const diff = dayjs(b.startTime).diff(now, 'minute');
            return diff > 0 && diff <= 15;
        });
        const over = seated
            .filter(b => b.seatedAt && now.diff(dayjs(b.seatedAt), 'minute') > turnover)
            .map(b => ({
                tables: (b.tables ?? []).map(x => x.name),
                over: now.diff(dayjs(b.seatedAt as string), 'minute') - turnover,
            }))
            .filter(o => o.tables.length > 0)
            .sort((a, b) => b.over - a.over);
        return {
            seatedCovers,
            totalCovers,
            tablesNow: tablesNow.size,
            totalTables,
            nextCount: next.length,
            nextCovers: next.reduce((s, b) => s + b.size, 0),
            overCount: over.length,
            worst: over[0] ?? null,
        };
    }, [bookings, date, layoutTables, turnover]);

    const tile = "flex items-center gap-2.5 bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-2xl px-3.5 min-h-[56px] shadow-sm flex-1 min-w-[150px]";

    return (
        <div className="flex-none flex gap-2 overflow-x-auto pb-0.5">
            <div className={tile}>
                <Users className="w-5 h-5 text-indigo-500 shrink-0" />
                <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 dark:text-white tabular-nums leading-none">
                        {m.seatedCovers}/{m.totalCovers}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-0.5">
                        {t('metrics.covers')}
                    </p>
                </div>
            </div>
            <div className={tile}>
                <Armchair className="w-5 h-5 text-blue-500 shrink-0" />
                <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 dark:text-white tabular-nums leading-none">
                        {m.tablesNow}/{m.totalTables}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-0.5">
                        {t('metrics.tables')}
                    </p>
                </div>
            </div>
            <div className={tile}>
                <Clock3 className="w-5 h-5 text-amber-500 shrink-0" />
                <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 dark:text-white tabular-nums leading-none">
                        {m.nextCount} · {m.nextCovers}p
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-0.5">
                        {t('metrics.next15')}
                    </p>
                </div>
            </div>
            <div className={cn(tile, m.overCount > 0 && "border-red-300 dark:border-red-500/40")}>
                <Timer className={cn("w-5 h-5 shrink-0", m.overCount > 0 ? "text-red-500" : "text-emerald-500")} />
                <div className="min-w-0">
                    <p className={cn(
                        "text-sm font-black tabular-nums leading-none",
                        m.overCount > 0 ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-white",
                    )}>
                        {m.overCount > 0 && m.worst
                            ? t('metrics.overFmt')
                                .replace('{t}', m.worst.tables.join(', '))
                                .replace('{m}', String(m.worst.over))
                            : t('metrics.onTime')}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-0.5">
                        {t('metrics.overstay')} {m.overCount > 0 ? `(${m.overCount})` : ''}
                    </p>
                </div>
            </div>
        </div>
    );
};
