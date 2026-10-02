import React, { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import dayjs, { RESTAURANT_TZ } from '../utils/dayjs';
import { api } from '../services/api';
import { useBookingsContext } from '../context/useBookingsContext';
import { useRestaurantSettings } from '../hooks/useFloorPlan';
import { useTranslation } from '../i18n/useTranslation';
import { bookingUrgency, lateMinutes, matchesHostQuery, formatTableLabels } from '../utils/bookingUtils';
import { cn } from '../lib/utils';
import type { Booking } from '../types';

interface ArrivalStripProps {
    date: string;
    /** Query from the host command bar — same filter as the agenda. */
    hostQuery?: string;
    /** Highlight the booking's tables on the map (tap = select). */
    onHighlight?: (id: string | null) => void;
}

/**
 * Phone/tablet arrivals strip: horizontal snap-scroll cards under the map
 * (replaces the overlay agenda below xl). Urgency-sorted (late → arriving
 * → upcoming); tap expands Valider / Annuler inline.
 */
export const ArrivalStrip: React.FC<ArrivalStripProps> = ({ date, hostQuery = '', onHighlight }) => {
    const { t } = useTranslation();
    const { bookings, refresh } = useBookingsContext();
    const { settings } = useRestaurantSettings();
    const grace = settings?.lateGraceMinutes ?? 15;
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const now = dayjs();

    const cards = useMemo(() => {
        const open = bookings.filter(
            b =>
                dayjs(b.startTime).tz(RESTAURANT_TZ).format('YYYY-MM-DD') === date &&
                (b.status === 'PENDING' || b.status === 'CONFIRMED') &&
                matchesHostQuery(b, hostQuery),
        );
        const rank = (b: Booking) => {
            if (bookingUrgency(b, now, grace) === 'late') return 0;
            return dayjs(b.startTime).diff(now, 'minute') <= 45 ? 1 : 2;
        };
        return [...open].sort((a, b) => rank(a) - rank(b) || dayjs(a.startTime).unix() - dayjs(b.startTime).unix());
        // now/grace are render-time values; recompute every render is intended.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bookings, date, hostQuery]);

    const toggle = (b: Booking) => {
        setExpandedId(prev => (prev === b.id ? null : b.id));
        setConfirmCancelId(null);
        onHighlight?.(b.id);
    };

    const checkIn = async (id: string) => {
        setBusy(true);
        try {
            await api.checkIn(id);
            setExpandedId(null);
            await refresh();
        } finally {
            setBusy(false);
        }
    };

    const askCancel = (id: string) => {
        setConfirmCancelId(id);
        window.setTimeout(() => {
            setConfirmCancelId(prev => (prev === id ? null : prev));
        }, 4000);
    };

    const doCancel = async (id: string) => {
        setBusy(true);
        try {
            await api.cancelBooking(id);
            setConfirmCancelId(null);
            setExpandedId(null);
            await refresh();
        } finally {
            setBusy(false);
        }
    };

    if (cards.length === 0) {
        return (
            <div className="flex-none px-4 py-3 text-center text-xs font-bold text-slate-400 dark:text-slate-500">
                {t('strip.empty')}
            </div>
        );
    }

    return (
        <div
            className="flex gap-2 overflow-x-auto px-3 py-2 snap-x snap-mandatory"
            role="list"
            aria-label={t('strip.title')}
        >
            {cards.map(b => {
                const late = bookingUrgency(b, now, grace) === 'late';
                const arriving = !late && dayjs(b.startTime).diff(now, 'minute') <= 45;
                const expanded = expandedId === b.id;
                const tables = formatTableLabels(b.tables ?? []);
                return (
                    <div
                        key={b.id}
                        role="listitem"
                        className={cn(
                            "snap-start shrink-0 w-40 rounded-2xl border-2 bg-white dark:bg-slate-900 p-2.5 text-left transition-all",
                            expanded
                                ? "border-indigo-500 shadow-lg"
                                : late
                                  ? "border-red-200 dark:border-red-500/40"
                                  : "border-slate-200 dark:border-slate-700",
                        )}
                    >
                        <button
                            onClick={() => toggle(b)}
                            aria-expanded={expanded}
                            className="w-full text-left cursor-pointer"
                        >
                            <div className="flex items-center justify-between gap-1">
                                <span className="text-[11px] font-black tabular-nums text-slate-500 dark:text-slate-400">
                                    {dayjs(b.startTime).tz(RESTAURANT_TZ).format('HH:mm')}
                                </span>
                                {late ? (
                                    <span className="text-[9px] font-black uppercase tracking-wider text-red-600 animate-pulse">
                                        {t('sheet.lateFmt').replace('{n}', String(lateMinutes(b, now)))}
                                    </span>
                                ) : arriving ? (
                                    <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                        {t('sheet.expected')}
                                    </span>
                                ) : (
                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                                        {b.size} {t('sheet.covers')}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm font-black text-slate-900 dark:text-white truncate mt-0.5">{b.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 truncate">
                                {b.size} {t('sheet.covers')}
                                {tables.length > 0 ? ` · ${tables.join(', ')}` : ''}
                                {b.depositStatus === 'HELD' ? ` · ${t('sheet.deposit_HELD')}` : ''}
                            </p>
                        </button>
                        {expanded && (
                            <div className="flex gap-1.5 mt-2">
                                <button
                                    onClick={() => checkIn(b.id)}
                                    disabled={busy}
                                    className="flex-1 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
                                >
                                    <Check className="w-3.5 h-3.5" /> {t('sheet.seat')}
                                </button>
                                {confirmCancelId === b.id ? (
                                    <button
                                        onClick={() => doCancel(b.id)}
                                        disabled={busy}
                                        className="flex-1 h-9 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase tracking-wider animate-pulse cursor-pointer disabled:opacity-50"
                                    >
                                        {t('sheet.confirmCancel')}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => askCancel(b.id)}
                                        aria-label={t('sheet.cancel')}
                                        className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-red-600 transition-all cursor-pointer flex items-center justify-center shrink-0"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
