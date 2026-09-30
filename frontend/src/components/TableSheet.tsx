import React, { useMemo, useState } from 'react';
import { X, Check, Plus, Clock, Users } from 'lucide-react';
import dayjs, { RESTAURANT_TZ } from '../utils/dayjs';
import { api } from '../services/api';
import { useBookingsContext } from '../context/useBookingsContext';
import { useRestaurantSettings } from '../hooks/useFloorPlan';
import { useTranslation } from '../i18n/useTranslation';
import { bookingUrgency, lateMinutes } from '../utils/bookingUtils';
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
        if (u === 'seated') return <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">{t('sheet.seated')}</span>;
        if (u === 'done') return null;
        if (u === 'late')
            return (
                <span className="text-[10px] font-black uppercase tracking-wider text-red-600 animate-pulse">
                    {t('sheet.lateFmt').replace('{n}', String(lateMinutes(b, now)))}
                </span>
            );
        if (u === 'expected')
            return <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">{t('sheet.expected')}</span>;
        return (
            <span className="text-[10px] font-bold text-slate-400">
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

    return (
        <div className="absolute inset-x-3 bottom-3 md:left-auto md:right-4 md:bottom-4 md:w-[340px] z-40 bg-white rounded-[1.75rem] shadow-2xl border border-slate-200 overflow-hidden max-h-[70%] flex flex-col">
            <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-slate-100 flex-none">
                <div className="min-w-0 mr-auto">
                    <p className="text-base font-black text-slate-900 tracking-tight leading-none">
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
                    className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all cursor-pointer shrink-0"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="overflow-y-auto p-3 space-y-2">
                {rows.length === 0 && (
                    <p className="text-xs font-bold text-slate-400 text-center py-3">{t('sheet.noBookings')}</p>
                )}
                {rows.map(b => {
                    const open = b.status === 'PENDING' || b.status === 'CONFIRMED';
                    const moving = movingId === b.id;
                    return (
                        <div key={b.id} className="bg-slate-50/70 border border-slate-100 rounded-2xl p-3">
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-black text-slate-900 tabular-nums bg-slate-900 text-white px-2 py-0.5 rounded-md">
                                    {dayjs(b.startTime).tz(RESTAURANT_TZ).format('HH:mm')}
                                </span>
                                <p className="text-sm font-black text-slate-900 truncate flex-1 min-w-0">{b.name}</p>
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-slate-500 shrink-0">
                                    <Users className="w-3 h-3" />
                                    {b.size}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-2">
                                {urgencyLabel(b)}
                                <div className="flex items-center gap-1.5 ml-auto">
                                    <button
                                        onClick={() => onFocusBooking(b.name)}
                                        className="h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-200/70 transition-all cursor-pointer"
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
                                                    moving ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600",
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
                                        </>
                                    )}
                                </div>
                            </div>

                            {moving && open && (
                                <div className="mt-2 pt-2 border-t border-slate-200/70">
                                    <div className="flex flex-wrap gap-1.5">
                                        {TIME_SLOTS.map(s => (
                                            <button
                                                key={s}
                                                onClick={() => setMoveSlot(s)}
                                                className={cn(
                                                    "px-2.5 h-8 rounded-lg text-[11px] font-black tabular-nums transition-all cursor-pointer border",
                                                    (moveSlot ?? dayjs(b.startTime).tz(RESTAURANT_TZ).format('HH:mm')) === s
                                                        ? "bg-indigo-600 text-white border-indigo-600"
                                                        : "bg-white text-slate-500 border-slate-200 hover:border-indigo-300",
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
                                            className="h-9 bg-white border border-slate-200 rounded-xl px-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-400"
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
                                className="w-full flex items-center gap-2 bg-indigo-50/60 hover:bg-indigo-100 border border-indigo-100 rounded-2xl px-3 min-h-[48px] mb-1.5 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50 text-left"
                            >
                                <span className="text-[11px] font-black tabular-nums text-indigo-700">
                                    {dayjs(b.startTime).tz(RESTAURANT_TZ).format('HH:mm')}
                                </span>
                                <span className="text-sm font-black text-slate-900 truncate flex-1 min-w-0">{b.name}</span>
                                <span className="text-[10px] font-black text-indigo-500 shrink-0">
                                    {b.size} {t('sheet.covers')}
                                </span>
                            </button>
                        ))}
                    </div>
                )}

                <button
                    onClick={() => onQuickCreate(tableId)}
                    className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 rounded-2xl min-h-[48px] text-xs font-black text-slate-500 hover:text-indigo-600 transition-all cursor-pointer"
                >
                    <Plus className="w-4 h-4" /> {t('sheet.newBooking')}
                </button>
            </div>
        </div>
    );
};
