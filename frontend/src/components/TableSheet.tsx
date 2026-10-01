import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Check, Plus, Clock, Users } from 'lucide-react';
import dayjs, { RESTAURANT_TZ } from '../utils/dayjs';
import { api } from '../services/api';
import { useBookingsContext } from '../context/useBookingsContext';
import { useRestaurantSettings } from '../hooks/useFloorPlan';
import { useTranslation } from '../i18n/useTranslation';
import { bookingUrgency, lateMinutes, TAG_EMOJI, tagDetail, ageYears } from '../utils/bookingUtils';
import { cn } from '../lib/utils';
import type { Booking } from '../types';

const TIME_SLOTS = ['16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'];

interface TableSheetProps {
    tableId: string;
    seats: number;
    /** Selected day (YYYY-MM-DD). */
    date: string;
    onClose: () => void;
    /** Jump to the arrivals list filtered on this guest. */
    onFocusBooking: (name: string) => void;
    /** Open the quick-résa modal prefilled for this table. */
    onQuickCreate: (tableId: string) => void;
}

/**
 * Host guichet for one table: who is expected (late-aware), 1-tap
 * check-in, inline time/date move, seat-an-unseated here, new booking.
 */
export const TableSheet: React.FC<TableSheetProps> = ({ tableId, seats, date, onClose, onFocusBooking, onQuickCreate }) => {
    const { t } = useTranslation();
    const { bookings, refresh } = useBookingsContext();
    const { settings } = useRestaurantSettings();
    const grace = settings?.lateGraceMinutes ?? 15;
    const [now] = useState(() => dayjs());
    const [movingId, setMovingId] = useState<string | null>(null);
    const [moveSlot, setMoveSlot] = useState<string | null>(null);
    const [moveDate, setMoveDate] = useState<string | null>(null);
    const [suggestion, setSuggestion] = useState<{ forId: string; tables: string[] } | null>(null);
    const [busy, setBusy] = useState(false);
    const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

    const noShows = useMemo(
        () =>
            bookings
                .filter(b => dayjs(b.startTime).tz(RESTAURANT_TZ).format('YYYY-MM-DD') === date)
                .filter(b => b.status === 'CANCELLED' && b.cancelledBy === 'AUTO')
                .filter(b => b.tables?.some(x => x.name === tableId))
                .sort((a, b) => dayjs(a.startTime).unix() - dayjs(b.startTime).unix()),
        [bookings, date, tableId],
    );

    const rows = useMemo(
        () =>
            bookings
                .filter(b => dayjs(b.startTime).tz(RESTAURANT_TZ).format('YYYY-MM-DD') === date)
                .filter(b => b.tables?.some(x => x.name === tableId))
                .sort((a, b) => dayjs(a.startTime).unix() - dayjs(b.startTime).unix()),
        [bookings, date, tableId],
    );

    const unseatedHere = useMemo(
        () =>
            bookings
                .filter(b => dayjs(b.startTime).tz(RESTAURANT_TZ).format('YYYY-MM-DD') === date)
                .filter(b => b.status === 'PENDING' || b.status === 'CONFIRMED')
                .filter(b => !b.tables || b.tables.length === 0)
                .filter(b => b.size <= seats)
                .sort((a, b) => dayjs(a.startTime).unix() - dayjs(b.startTime).unix()),
        [bookings, date, seats],
    );

    const openRows = rows.filter(b => b.status === 'PENDING' || b.status === 'CONFIRMED');
    const current = openRows.find(b => {
        const s = dayjs(b.startTime);
        const e = dayjs(b.endTime);
        return (now.isAfter(s) || now.isSame(s)) && now.isBefore(e);
    });
    const next = openRows.find(b => dayjs(b.startTime).isAfter(now));

    const statusPill = current ? (
        <span className="text-[10px] font-black uppercase tracking-widest text-blue-700 bg-blue-100 px-2.5 py-1 rounded-lg">
            {t('sheet.busyUntil').replace('{t}', dayjs(current.endTime).tz(RESTAURANT_TZ).format('HH:mm'))}
        </span>
    ) : next ? (
        <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-100 px-2.5 py-1 rounded-lg">
            {t('sheet.nextAt').replace('{t}', dayjs(next.startTime).tz(RESTAURANT_TZ).format('HH:mm'))}
        </span>
    ) : (
        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
            {t('sheet.free')}
        </span>
    );

    const urgencyLabel = (b: Booking) => {
        const u = bookingUrgency(b, now, grace);
        if (u === 'seated') return <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">{t('sheet.seated')}</span>;
        if (u === 'done') return null;
        if (u === 'late')
            return (
                <span className="text-[10px] font-black uppercase tracking-wider text-red-600 animate-pulse">
                    {t('sheet.lateFmt').replace('{n}', String(lateMinutes(b, now)))}
                </span>
            );
        if (u === 'expected')
            return <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">{t('sheet.expected')}</span>;
        return (
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                {dayjs(b.startTime).tz(RESTAURANT_TZ).format('HH:mm')}
            </span>
        );
    };

    const checkIn = async (id: string) => {
        setBusy(true);
        try {
            await api.checkIn(id);
            await refresh();
        } finally {
            setBusy(false);
        }
    };

    /** Inline 2-tap cancel: first tap arms, second confirms (auto-disarms). */
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
            await refresh();
        } finally {
            setBusy(false);
        }
    };

    const confirmMove = async (b: Booking, tableNames?: string[]) => {
        const slot = moveSlot ?? dayjs(b.startTime).tz(RESTAURANT_TZ).format('HH:mm');
        const day = moveDate ?? dayjs(b.startTime).tz(RESTAURANT_TZ).format('YYYY-MM-DD');
        setBusy(true);
        try {
            await api.rescheduleBooking(b.id, {
                startTime: dayjs.tz(`${day} ${slot}`, RESTAURANT_TZ).toISOString(),
                tableNames,
            });
            setMovingId(null);
            setSuggestion(null);
            await refresh();
        } catch (e) {
            const err = e as Error & { status?: number; suggestion?: string[] };
            if (err.status === 409) {
                setSuggestion({ forId: b.id, tables: err.suggestion ?? [] });
            }
        } finally {
            setBusy(false);
        }
    };

    const seatHere = async (b: Booking) => {
        setBusy(true);
        try {
            await api.updateAssignment(b.id, [tableId]);
            await api.checkIn(b.id);
            await refresh();
        } finally {
            setBusy(false);
        }
    };

    /** Visible tag detail lines (allergy note, birthday + age, VIP note). */
    const tagDetailLines = (b: Booking): string[] => {
        const out: string[] = [];
        for (const tag of b.tags ?? []) {
            const detail = tagDetail(b, tag);
            if (tag === 'BIRTHDAY' && b.birthdayDate) {
                const age = ageYears(b.birthdayDate);
                const when = dayjs(b.birthdayDate).format('DD/MM/YYYY');
                out.push(`🎂 ${when}${age !== null ? ` (${t('sheet.ageFmt').replace('{n}', String(age))})` : ''}`);
            } else if (detail) {
                out.push(`${TAG_EMOJI[tag] ?? '•'} ${detail}`);
            }
        }
        return out;
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 z-30 bg-slate-900/25 cursor-pointer"
            />
            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                drag="y"
                dragConstraints={{ top: 0 }}
                dragElastic={{ top: 0, bottom: 0.6 }}
                onDragEnd={(_, info) => {
                    if (info.offset.y > 120 || info.velocity.y > 500) onClose();
                }}
                className="absolute inset-x-0 bottom-0 z-40 bg-white dark:bg-slate-900 rounded-t-[2rem] shadow-2xl border-t border-x border-slate-200 dark:border-slate-700 overflow-hidden max-h-[75%] flex flex-col"
            >
            <div className="pt-2.5 pb-1 flex justify-center flex-none touch-none">
                <div className="w-10 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>
            <div className="flex items-center gap-3 px-4 sm:px-6 pb-3 border-b border-slate-100 dark:border-slate-700 flex-none">
                <div className="min-w-0 mr-auto">
                    <p className="text-base font-black text-slate-900 dark:text-white tracking-tight leading-none">
                        Table {tableId} <span className="text-slate-400 font-bold text-xs">· {seats} {t('sheet.covers')}</span>
                    </p>
                    <div className="mt-1.5">{statusPill}</div>
                </div>
                <button
                    onClick={() => {
                        onFocusBooking('');
                        onClose();
                    }}
                    aria-label="Close"
                    className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all cursor-pointer shrink-0"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="overflow-y-auto px-4 sm:px-6 py-3 space-y-2">
                <div className="max-w-3xl mx-auto w-full space-y-2 pb-2">
                {rows.length === 0 && (
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 text-center py-3">{t('sheet.noBookings')}</p>
                )}
                {rows.map(b => {
                    const open = b.status === 'PENDING' || b.status === 'CONFIRMED';
                    const moving = movingId === b.id;
                    return (
                        <div key={b.id} className="bg-slate-50/70 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700 rounded-2xl p-3">
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-black text-slate-900 tabular-nums bg-slate-900 text-white px-2 py-0.5 rounded-md">
                                    {dayjs(b.startTime).tz(RESTAURANT_TZ).format('HH:mm')}
                                </span>
                                <p className="text-sm font-black text-slate-900 dark:text-white truncate flex-1 min-w-0">{b.name}</p>
                                {(b.tags ?? []).slice(0, 3).map(tag => (
                                    <span key={tag} className="text-xs leading-none" title={tagDetail(b, tag) ?? tag}>{TAG_EMOJI[tag] ?? '•'}</span>
                                ))}
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-slate-500 dark:text-slate-400 shrink-0">
                                    <Users className="w-3 h-3" />
                                    {b.size}
                                </span>
                            </div>
                            {tagDetailLines(b).length > 0 && (
                                <div className="mt-1.5 space-y-0.5">
                                    {tagDetailLines(b).map((line, i) => (
                                        <p key={i} className="text-[11px] font-bold text-violet-600 dark:text-violet-300 truncate">{line}</p>
                                    ))}
                                </div>
                            )}
                            <div className="flex items-center justify-between gap-2 mt-2">
                                {urgencyLabel(b)}
                                <div className="flex items-center gap-1.5 ml-auto">
                                    <button
                                        onClick={() => onFocusBooking(b.name)}
                                        className="h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-all cursor-pointer"
                                    >
                                        {t('sheet.view')}
                                    </button>
                                    {open && (
                                        <>
                                            <button
                                                onClick={() => {
                                                    setMovingId(moving ? null : b.id);
                                                    setSuggestion(null);
                                                    setMoveSlot(null);
                                                    setMoveDate(null);
                                                }}
                                                className={cn(
                                                    "h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1",
                                                    moving ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900" : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300",
                                                )}
                                            >
                                                <Clock className="w-3.5 h-3.5" /> {t('sheet.move')}
                                            </button>
                                            <button
                                                onClick={() => checkIn(b.id)}
                                                disabled={busy}
                                                className="h-9 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                            >
                                                <Check className="w-3.5 h-3.5" /> {t('sheet.seat')}
                                            </button>
                                            {confirmCancelId === b.id ? (
                                                <button
                                                    onClick={() => doCancel(b.id)}
                                                    disabled={busy}
                                                    className="h-9 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer disabled:opacity-50 animate-pulse"
                                                >
                                                    {t('sheet.confirmCancel')}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => askCancel(b.id)}
                                                    aria-label={t('sheet.cancel')}
                                                    className="h-9 w-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-400 hover:text-red-600 hover:border-red-200 transition-all cursor-pointer flex items-center justify-center shrink-0"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {moving && open && (
                                <div className="mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-700">
                                    <div className="flex flex-wrap gap-1.5">
                                        {TIME_SLOTS.map(s => (
                                            <button
                                                key={s}
                                                onClick={() => setMoveSlot(s)}
                                                className={cn(
                                                    "px-2.5 h-8 rounded-lg text-[11px] font-black tabular-nums transition-all cursor-pointer border",
                                                    (moveSlot ?? dayjs(b.startTime).tz(RESTAURANT_TZ).format('HH:mm')) === s
                                                        ? "bg-indigo-600 text-white border-indigo-600"
                                                        : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-300",
                                                )}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <input
                                            type="date"
                                            value={moveDate ?? dayjs(b.startTime).tz(RESTAURANT_TZ).format('YYYY-MM-DD')}
                                            onChange={e => setMoveDate(e.target.value)}
                                            className="h-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-2 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-400"
                                        />
                                        <button
                                            onClick={() => confirmMove(b)}
                                            disabled={busy}
                                            className="h-9 flex-1 rounded-xl bg-slate-900 hover:bg-slate-700 text-white text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                                        >
                                            {t('sheet.confirm')}
                                        </button>
                                    </div>
                                    {suggestion?.forId === b.id && (
                                        <button
                                            onClick={() => confirmMove(b, suggestion.tables)}
                                            disabled={busy || suggestion.tables.length === 0}
                                            className="mt-2 w-full min-h-[44px] rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 text-[11px] font-black px-3 py-2 transition-all cursor-pointer disabled:opacity-50"
                                        >
                                            {suggestion.tables.length > 0
                                                ? t('sheet.acceptSuggestion').replace('{t}', suggestion.tables.join(', '))
                                                : t('sheet.noSolution')}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {noShows.length > 0 && (
                    <div className="pt-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-red-400 px-1 mb-1.5">
                            {t('sheet.noShowTitle')}
                        </p>
                        {noShows.map(b => (
                            <div
                                key={b.id}
                                className="w-full flex items-center gap-2 bg-red-50/60 border border-red-100 rounded-2xl px-3 min-h-[48px] mb-1.5"
                            >
                                <span className="text-[11px] font-black tabular-nums text-red-400">
                                    {dayjs(b.startTime).tz(RESTAURANT_TZ).format('HH:mm')}
                                </span>
                                <span className="text-sm font-bold text-slate-500 line-through truncate flex-1 min-w-0">{b.name}</span>
                                <span className="text-[9px] font-black uppercase tracking-wider text-red-500 shrink-0">
                                    {t('sheet.noShow')}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {!current && unseatedHere.length > 0 && (
                    <div className="pt-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1 mb-1.5">
                            {t('sheet.seatHere')}
                        </p>
                        {unseatedHere.slice(0, 4).map(b => (
                            <button
                                key={b.id}
                                onClick={() => seatHere(b)}
                                disabled={busy}
                                className="w-full flex items-center gap-2 bg-indigo-50/60 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl px-3 min-h-[48px] mb-1.5 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50 text-left"
                            >
                                <span className="text-[11px] font-black tabular-nums text-indigo-700">
                                    {dayjs(b.startTime).tz(RESTAURANT_TZ).format('HH:mm')}
                                </span>
                                <span className="text-sm font-black text-slate-900 dark:text-white truncate flex-1 min-w-0">{b.name}</span>
                                <span className="text-[10px] font-black text-indigo-500 shrink-0">
                                    {b.size} {t('sheet.covers')}
                                </span>
                            </button>
                        ))}
                    </div>
                )}

                <button
                    onClick={() => onQuickCreate(tableId)}
                    className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40 rounded-2xl min-h-[48px] text-xs font-black text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all cursor-pointer"
                >
                    <Plus className="w-4 h-4" /> {t('sheet.newBooking')}
                </button>
                </div>
            </div>
            </motion.div>
        </>
    );
};
