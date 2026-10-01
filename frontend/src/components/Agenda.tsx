import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import dayjs, { RESTAURANT_TZ } from '../utils/dayjs';
import { CheckCircle2, XCircle, AlertTriangle, Search, Users, ListFilter, Clock3, BadgeCheck } from 'lucide-react';
import clsx from 'clsx';
import { cn } from '../lib/utils';
import { api } from '../services/api';
import { DatePicker } from './ui/date-picker';
import {
  calculateAffluence,
  affluenceClassNames,
  formatTableLabels,
  matchesHostQuery,
  bookingUrgency,
  lateMinutes,
  groupBySlot,
  matchesSizeBand,
  TAG_EMOJI,
  tagDetail,
  type SizeBand,
} from '../utils/bookingUtils';
import { useRestaurantSettings } from '../hooks/useFloorPlan';
import type { Booking } from '../types';
import { useBookingsContext } from '../context/useBookingsContext';
import { useTranslation } from '../i18n/useTranslation';

interface AgendaProps {
  setHoveredBookingId: (id: string | null) => void;
  date: string;
  setDate: (date: string) => void;
  className?: string;
  /** Query from the host command bar — the single search field. */
  externalQuery?: string;
  /** Booking currently in map placement mode (highlighted row). */
  selectedBookingId?: string | null;
  /** Enter map placement mode for an unseated booking. */
  onPlaceTables?: (id: string) => void;
  /** Split view: rows are draggable onto map tables. */
  draggableRows?: boolean;
  onDragOverTable?: (tableId: string | null) => void;
  onAssignRowDrop?: (bookingId: string, tableId: string) => void;
}

/** Table under a viewport point during list→map drag (touch-compatible). */
const pickTableId = (x: number, y: number): string | null => {
  if (typeof document === 'undefined' || typeof document.elementsFromPoint !== 'function') return null;
  const els = document.elementsFromPoint(x, y) as HTMLElement[];
  for (const el of els) {
    const t = el.closest?.('[data-table-id]');
    if (t) return t.getAttribute('data-table-id');
  }
  return null;
};

type AgendaView = 'timeline' | 'arrivals';

const SIZE_BANDS: { id: SizeBand; label: string }[] = [
  { id: 'all', label: 'Tout' },
  { id: '2', label: '2' },
  { id: '4', label: '4' },
  { id: '6p', label: '6+' },
];

export const Agenda: React.FC<AgendaProps> = ({ setHoveredBookingId, date, setDate, className, externalQuery = '', selectedBookingId = null, onPlaceTables, draggableRows = false, onDragOverTable, onAssignRowDrop }) => {
  const { t } = useTranslation();
  const { bookings, refresh } = useBookingsContext();
  const [showModal, setShowModal] = useState<{ id: string, name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sizeBand, setSizeBand] = useState<SizeBand>('all');
  const [onlyUnseated, setOnlyUnseated] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [view, setView] = useState<AgendaView>(() =>
    typeof localStorage !== 'undefined' && localStorage.getItem('agenda-view') === 'arrivals' ? 'arrivals' : 'timeline',
  );
  const { settings } = useRestaurantSettings();
  const grace = settings?.lateGraceMinutes ?? 15;
  const listRef = useRef<HTMLDivElement>(null);
  const nowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem('agenda-view', view);
    } catch {
      // Private mode — view simply resets next visit.
    }
  }, [view]);

  const handleCheckIn = async (id: string) => {
    try {
      setLoading(true);
      await api.checkIn(id);
      refresh();
    } catch (e) {
      console.error(e);
      alert(t('agenda.checkinFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!showModal) return;
    try {
      setLoading(true);
      await api.cancelBooking(showModal.id);
      refresh();
      setShowModal(null);
    } catch (e) {
      console.error(e);
      alert(t('agenda.cancelFailed'));
    } finally {
      setLoading(false);
    }
  };

  /** Inline 2-tap cancel (same pattern as the table sheet). */
  const askCancel = (id: string) => {
    setConfirmCancelId(id);
    window.setTimeout(() => {
      setConfirmCancelId(prev => (prev === id ? null : prev));
    }, 4000);
  };

  const doCancel = async (id: string) => {
    try {
      setLoading(true);
      await api.cancelBooking(id);
      setConfirmCancelId(null);
      refresh();
    } catch (e) {
      console.error(e);
      alert(t('agenda.cancelFailed'));
    } finally {
      setLoading(false);
    }
  };

  const toggleConfirm = async (b: Booking) => {
    try {
      await api.toggleGuestConfirm(b.id);
      refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const dayBookings = bookings
    .filter(b => dayjs(b.startTime).tz(RESTAURANT_TZ).format('YYYY-MM-DD') === date);

  const unseatedCount = dayBookings.filter(
    b => (b.status === 'PENDING' || b.status === 'CONFIRMED') && (!b.tables || b.tables.length === 0),
  ).length;

  const activeDay = dayBookings.filter(b => b.status !== 'CANCELLED');
  const seatedDay = dayBookings.filter(b => b.status === 'COMPLETED').length;

  const filteredBookings = dayBookings
    .filter(b => matchesHostQuery(b, externalQuery))
    .filter(b => matchesSizeBand(b, sizeBand))
    .filter(b => !onlyUnseated || !b.tables || b.tables.length === 0)
    .sort((a, b) => dayjs(a.startTime).unix() - dayjs(b.startTime).unix());

  // Rush relevance (arrivals view): arriving now (±45 min) → upcoming → done.
  const rankedBookings = [...filteredBookings].sort((a, b) => {
    const now = dayjs();
    const rank = (x: Booking) => {
      if (x.status === 'CANCELLED' || x.status === 'COMPLETED') return 2;
      return dayjs(x.startTime).diff(now, 'minute') <= 45 ? 0 : 1;
    };
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return dayjs(a.startTime).unix() - dayjs(b.startTime).unix();
  });

  // Visual sections for the arrivals view.
  const nowStamp = dayjs();
  const isToday = dayjs.tz(date, RESTAURANT_TZ).format('YYYY-MM-DD') === nowStamp.tz(RESTAURANT_TZ).format('YYYY-MM-DD');
  const urgencyOf = (b: Booking) => bookingUrgency(b, nowStamp, grace);
  const isDispute = (b: Booking) =>
    (b.status === 'PENDING' || b.status === 'CONFIRMED') && lateMinutes(b, nowStamp) > 60;
  const [showDisputes, setShowDisputes] = useState(false);
  const openRanked = rankedBookings.filter(b => b.status !== 'CANCELLED' && b.status !== 'COMPLETED');
  const doneRanked = rankedBookings.filter(b => b.status === 'CANCELLED' || b.status === 'COMPLETED');
  const disputeRanked = openRanked.filter(isDispute);
  const cleanRanked = openRanked.filter(b => !isDispute(b));
  const nowRanked = cleanRanked.filter(b => dayjs(b.startTime).diff(nowStamp, 'minute') <= 45);
  const laterRanked = cleanRanked.filter(b => dayjs(b.startTime).diff(nowStamp, 'minute') > 45);
  const coversOf = (list: Booking[]) => list.reduce((s, b) => s + b.size, 0);

  // Timeline grouping (default view).
  const openFiltered = filteredBookings.filter(b => b.status !== 'CANCELLED' && b.status !== 'COMPLETED');
  const doneFiltered = filteredBookings.filter(b => b.status === 'CANCELLED' || b.status === 'COMPLETED');
  const disputeFiltered = openFiltered.filter(isDispute);
  const slotGroups = groupBySlot(openFiltered.filter(b => !isDispute(b)));
  const nowSlot = slotKeyOf(nowStamp);

  function slotKeyOf(d: dayjs.Dayjs): string {
    const dd = d.tz(RESTAURANT_TZ);
    return `${dd.format('HH')}:${dd.minute() < 30 ? '00' : '30'}`;
  }

  const scrollToNow = () => {
    nowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const urgencyLabel = (b: Booking) => {
    const u = urgencyOf(b);
    if (u === 'seated') return <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600">{t('sheet.seated')}</span>;
    if (u === 'done') return null;
    if (u === 'late')
      return (
        <span className="text-[11px] font-black uppercase tracking-wider text-red-600 animate-pulse">
          {t('sheet.lateFmt').replace('{n}', String(lateMinutes(b, nowStamp)))}
        </span>
      );
    if (u === 'expected')
      return <span className="text-[11px] font-black uppercase tracking-wider text-amber-600">{t('sheet.expected')}</span>;
    return null;
  };

  const tableChips = (b: Booking) => {
    if (!b.tables || b.tables.length === 0) {
      if (b.status === 'CANCELLED' || b.status === 'COMPLETED') return null;
      return (
        <span className="text-[9px] font-black uppercase tracking-wider text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-500/15 border border-orange-300 dark:border-orange-500/30 px-1.5 py-0.5 rounded-md">
          {t('agenda.unassigned')}
        </span>
      );
    }
    return (
      <span className="flex flex-wrap gap-1">
        {formatTableLabels(b.tables).map((label, idx) => (
          <span key={idx} className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-md whitespace-nowrap">
            {label}
          </span>
        ))}
      </span>
    );
  };

  const primaryAction = (b: Booking) => {
    if (b.status === 'COMPLETED') {
      return (
        <span className="inline-flex items-center gap-1 bg-emerald-50 px-2.5 h-12 rounded-xl border border-emerald-100">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span className="text-[10px] font-black text-emerald-600 uppercase">OK</span>
        </span>
      );
    }
    if (b.status === 'CANCELLED') {
      return (
        <span className={cn(
          "inline-flex items-center px-2.5 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest border",
          b.cancelledBy === 'AUTO'
            ? "bg-red-50 border-red-200 text-red-500"
            : "bg-slate-100 border-slate-200 text-slate-400",
        )}>
          {b.cancelledBy === 'AUTO' ? t('agenda.noShowBadge') : t('agenda.cancelledBadge')}
        </span>
      );
    }
    if ((!b.tables || b.tables.length === 0) && onPlaceTables) {
      return (
        <button
          className="h-12 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider cursor-pointer shadow-lg shadow-indigo-600/25 active:scale-95"
          onClick={(e) => { e.stopPropagation(); onPlaceTables(b.id); }}
        >
          {t('agenda.placeTables')}
        </button>
      );
    }
    return (
      <button
        className="h-12 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-all flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
        onClick={(e) => { e.stopPropagation(); handleCheckIn(b.id); }}
        disabled={loading}
      >
        <CheckCircle2 className="w-4 h-4" /> {t('agenda.checkin')}
      </button>
    );
  };

  const inlineCancel = (b: Booking) => {
    if (b.status === 'CANCELLED' || b.status === 'COMPLETED') return null;
    return confirmCancelId === b.id ? (
      <button
        onClick={(e) => { e.stopPropagation(); doCancel(b.id); }}
        disabled={loading}
        className="h-11 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer disabled:opacity-50 animate-pulse"
      >
        {t('sheet.confirmCancel')}
      </button>
    ) : (
      <button
        onClick={(e) => { e.stopPropagation(); askCancel(b.id); }}
        aria-label={t('sheet.cancel')}
        className="h-12 w-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-300 hover:text-red-600 hover:border-red-200 transition-all cursor-pointer flex items-center justify-center shrink-0"
      >
        <XCircle className="w-5 h-5" />
      </button>
    );
  };

  const renderRow = (b: Booking) => {
    const open = b.status !== 'CANCELLED' && b.status !== 'COMPLETED';
    // Swipe right = seat/check-in, swipe left = arm cancel (buttons stay as fallback).
    const swipeAction = (dir: 1 | -1) => {
      if (!open) return;
      if (dir > 0) {
        if ((!b.tables || b.tables.length === 0) && onPlaceTables) onPlaceTables(b.id);
        else void handleCheckIn(b.id);
      } else {
        askCancel(b.id);
      }
    };
    return (
    <div
      key={b.id}
      className={clsx(
        "relative overflow-hidden rounded-2xl border transition-all duration-300",
        selectedBookingId === b.id
          ? "border-indigo-400 ring-2 ring-indigo-500/40 shadow-[0_20px_40px_-10px_rgba(79,70,229,0.25)]"
          : b.status === 'CANCELLED'
            ? "opacity-60 grayscale border-slate-100 dark:border-slate-700"
            : "border-slate-100 dark:border-slate-700",
      )}
    >
      <div className="absolute inset-0 flex items-stretch justify-between pointer-events-none" aria-hidden="true">
        <div className="flex items-center pl-4 w-24 bg-emerald-500 text-white">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div className="flex items-center justify-end pr-4 w-24 bg-red-500 text-white">
          <XCircle className="w-5 h-5" />
        </div>
      </div>
      <motion.div
        drag={open ? true : false}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.35}
        onDrag={(_, info) => {
          if (!(open && draggableRows)) return;
          onDragOverTable?.(pickTableId(info.point.x, info.point.y));
        }}
        onDragEnd={(_, info) => {
          onDragOverTable?.(null);
          if (open && draggableRows) {
            const tid = pickTableId(info.point.x, info.point.y);
            if (tid) {
              onAssignRowDrop?.(b.id, tid);
              return;
            }
          }
          if (!draggableRows) {
            if (info.offset.x > 90) swipeAction(1);
            else if (info.offset.x < -90) swipeAction(-1);
          }
        }}
        onMouseEnter={() => setHoveredBookingId(b.id)}
        onMouseLeave={() => setHoveredBookingId(null)}
        className="relative bg-white dark:bg-slate-800 grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 p-3 pl-4 cursor-grab active:cursor-grabbing touch-pan-y"
      >
      <div className={clsx(
        "absolute left-0 top-0 bottom-0 w-1.5 transition-all duration-500",
        b.status === 'COMPLETED' ? "bg-emerald-500" :
          b.status === 'CANCELLED' ? "bg-slate-300" :
          urgencyOf(b) === 'late' ? "bg-red-500 animate-pulse" :
          urgencyOf(b) === 'expected' ? "bg-amber-400" :
          "bg-slate-200",
      )} />

      <div className="min-w-0">
        <div className="text-lg font-black text-slate-900 dark:text-white tabular-nums leading-none">
          {dayjs(b.startTime).tz(RESTAURANT_TZ).format('HH:mm')}
        </div>
        <div className="inline-flex items-center gap-1 text-xs font-black text-slate-600 dark:text-slate-300 tabular-nums mt-1">
          <Users className="w-3.5 h-3.5" />
          {b.size}
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="text-[15px] font-black text-slate-900 dark:text-white tracking-tight truncate">
            {b.language === 'fr' ? '🇫🇷 ' : b.language === 'en' ? '🇬🇧 ' : b.language === 'it' ? '🇮🇹 ' : ''}
            {b.name}
          </h3>
          {(b.status === 'PENDING' || b.status === 'CONFIRMED') && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleConfirm(b); }}
              title={t('agenda.confirmGuest')}
              aria-label={t('agenda.confirmGuest')}
              className="shrink-0 min-h-[44px] min-w-[44px] -my-2 flex items-center justify-center cursor-pointer"
            >
              <BadgeCheck className={cn(
                "w-5 h-5 transition-colors",
                b.guestConfirmed ? "text-emerald-500 fill-emerald-100" : "text-slate-300 dark:text-slate-600",
              )} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1 min-w-0 flex-wrap">
          {(b.tags ?? []).slice(0, 3).map(tag => (
            <span key={tag} className="text-sm leading-none" title={tagDetail(b, tag) ?? tag}>{TAG_EMOJI[tag] ?? '•'}</span>
          ))}
          {(b.tags ?? []).length > 3 && (
            <span className="text-[9px] font-black text-slate-400">+{(b.tags ?? []).length - 3}</span>
          )}
          {urgencyLabel(b)}
          {b.lowTable && (
            <span className="text-[9px] font-black bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-500/20 uppercase">
              {t('agenda.lowBadge')}
            </span>
          )}
          {tableChips(b)}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {primaryAction(b)}
        {inlineCancel(b)}
      </div>
      </motion.div>
    </div>
    );
  };

  type Item =
    | { kind: 'head'; key: string; title: string; sub: string }
    | { kind: 'doneToggle'; key: string }
    | { kind: 'row'; b: Booking };
  const arrivalItems: Item[] = [];
  const pushSection = (key: string, title: string, list: Booking[]) => {
    if (list.length === 0) return;
    arrivalItems.push({
      kind: 'head',
      key: `head-${key}`,
      title,
      sub: t('agenda.countFmt').replace('{n}', String(list.length)).replace('{g}', String(coversOf(list))),
    });
    list.forEach(b => arrivalItems.push({ kind: 'row', b }));
  };
  pushSection('now', t('agenda.secNow'), nowRanked);
  pushSection('later', t('agenda.secLater'), laterRanked);
  if (doneRanked.length > 0) {
    if (showDone) {
      pushSection('done', t('agenda.secDone'), doneRanked);
    } else {
      arrivalItems.push({ kind: 'doneToggle', key: 'done-toggle' });
    }
  }

  const sectionHead = (key: string, title: string, sub: string, collapsible?: () => void) => {
    const inner = (
      <>
        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{title}</span>
        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tabular-nums">{sub}</span>
      </>
    );
    return collapsible ? (
      <button
        key={key}
        onClick={collapsible}
        className="sticky top-0 z-10 w-full flex items-baseline justify-between gap-2 px-2 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl cursor-pointer"
      >
        {inner}
      </button>
    ) : (
      <div key={key} className="sticky top-0 z-10 flex items-baseline justify-between gap-2 px-1 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl">
        {inner}
      </div>
    );
  };

  const progressPct = activeDay.length === 0 ? 0 : Math.round((seatedDay / activeDay.length) * 100);

  return (
    <div className={cn("bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 overflow-hidden h-full flex flex-col relative", className)}>
      {/* Slim header: date + view toggle */}
      <div className="px-4 pt-4 pb-3 flex-none space-y-3 bg-gradient-to-b from-slate-50/60 to-white dark:from-slate-900 dark:to-slate-900 border-b border-slate-100/50 dark:border-slate-700/50">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.25em]">{t('agenda.schedule')}</span>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider truncate">{dayjs.tz(date, RESTAURANT_TZ).format('dddd, D MMM')}</p>
          </div>
          <DatePicker
            date={dayjs(date).toDate()}
            setDate={d => setDate(dayjs(d).format('YYYY-MM-DD'))}
            displayFormat="dd/MM/yyyy"
            className="h-12 text-[11px] font-black cursor-pointer bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 hover:border-indigo-500/30 hover:shadow-md transition-all rounded-xl px-3 w-full min-w-0 dark:text-white"
            modifiers={calculateAffluence(bookings)}
            modifiersClassNames={affluenceClassNames}
          />
        </div>

        <div className="flex bg-slate-100/80 dark:bg-slate-800 p-1 rounded-xl gap-1">
          <button
            onClick={() => setView('timeline')}
            className={cn(
              "flex-1 min-h-[48px] rounded-lg text-[11px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5",
              view === 'timeline' ? "bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-300" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300",
            )}
          >
            <Clock3 className="w-4 h-4" /> {t('agenda.viewTimeline')}
          </button>
          <button
            onClick={() => setView('arrivals')}
            className={cn(
              "flex-1 min-h-[48px] rounded-lg text-[11px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5",
              view === 'arrivals' ? "bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-300" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300",
            )}
          >
            <ListFilter className="w-4 h-4" /> {t('agenda.viewArrivals')}
          </button>
        </div>

        {/* Service progress */}
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{t('agenda.service')}</span>
            <span className="text-[11px] font-black text-slate-600 dark:text-slate-300 tabular-nums">
              {t('agenda.progressFmt').replace('{s}', String(seatedDay)).replace('{t}', String(activeDay.length))}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Size chips + unseated filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {SIZE_BANDS.map(band => (
            <button
              key={band.id}
              onClick={() => setSizeBand(band.id)}
              className={cn(
                "min-h-[48px] px-4 rounded-xl text-[11px] font-black tabular-nums transition-all cursor-pointer border-2 shrink-0",
                sizeBand === band.id
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow"
                  : "bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-400 border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500",
              )}
            >
              {band.id === 'all' ? t('agenda.bandAll') : band.label}
            </button>
          ))}
          {unseatedCount > 0 && (
            <button
              onClick={() => setOnlyUnseated(v => !v)}
              className={cn(
                "min-h-[48px] px-4 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer border-2 shrink-0 flex items-center gap-1.5",
                onlyUnseated
                  ? "bg-red-600 text-white border-red-600 shadow-lg shadow-red-600/25"
                  : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30 hover:border-red-300",
              )}
            >
              <AlertTriangle className="w-4 h-4" />
              {unseatedCount}
            </button>
          )}
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50/40 dark:bg-black/20 relative">
        {(view === 'timeline' ? disputeFiltered : disputeRanked).length > 0 && (
          <div>
            <button
              onClick={() => setShowDisputes(v => !v)}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-3 min-h-[48px] rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all cursor-pointer border-2",
                showDisputes
                  ? "bg-red-600 text-white border-red-600 shadow-lg shadow-red-600/25"
                  : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30",
              )}
            >
              <AlertTriangle className="w-4 h-4" />
              {t('agenda.disputes')} ({(view === 'timeline' ? disputeFiltered : disputeRanked).length})
              <span>{showDisputes ? '−' : '+'}</span>
            </button>
            {showDisputes && (
              <div className="space-y-2.5 mt-2.5">
                {(view === 'timeline' ? disputeFiltered : disputeRanked).map(renderRow)}
              </div>
            )}
          </div>
        )}
        {filteredBookings.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border-2 border-dashed border-slate-200">
              <Search className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">{t('agenda.noMatch')}</p>
            <p className="text-[11px] text-slate-500 font-medium mt-1">{t('agenda.adjustFilters')}</p>
          </div>
        ) : view === 'timeline' ? (
          <>
            {slotGroups.map(({ slot, rows }) => {
              const lateInSlot = rows.filter(b => urgencyOf(b) === 'late').length;
              return (
                <div key={slot}>
                  {sectionHead(
                    `slot-${slot}`,
                    slot,
                    t('agenda.countFmt').replace('{n}', String(rows.length)).replace('{g}', String(coversOf(rows))),
                  )}
                  {isToday && slot === nowSlot && (
                    <div ref={nowRef} className="flex items-center gap-2 my-1.5">
                      <span className="text-[10px] font-black tabular-nums text-white bg-red-500 px-2 py-0.5 rounded-md shadow">
                        {nowStamp.tz(RESTAURANT_TZ).format('HH:mm')}
                      </span>
                      <div className="flex-1 h-0.5 bg-red-500/70 rounded-full" />
                    </div>
                  )}
                  <div className="space-y-2.5 mt-1.5">
                    {lateInSlot > 0 && (
                      <p className="text-[10px] font-black uppercase tracking-wider text-red-500 px-1">
                        {t('agenda.lateInSlot').replace('{n}', String(lateInSlot))}
                      </p>
                    )}
                    {rows.map(renderRow)}
                  </div>
                </div>
              );
            })}
            {isToday && doneFiltered.length > 0 && (
              <div>
                {showDone ? (
                  <>
                    {sectionHead(
                      'head-done',
                      `${t('agenda.secDone')} (${doneFiltered.length})`,
                      t('agenda.countFmt').replace('{n}', String(doneFiltered.length)).replace('{g}', String(coversOf(doneFiltered))),
                      () => setShowDone(false),
                    )}
                    <div className="space-y-2.5 mt-1.5">{doneFiltered.map(renderRow)}</div>
                  </>
                ) : (
                  <button
                    onClick={() => setShowDone(true)}
                    className="w-full min-h-[48px] rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    {t('agenda.secDone')} ({doneFiltered.length}) +
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          arrivalItems.map(it => {
            if (it.kind === 'head') {
              return sectionHead(it.key, it.title, it.sub, it.key === 'head-done' ? () => setShowDone(false) : undefined);
            }
            if (it.kind === 'doneToggle') {
              return (
                <button
                  key={it.key}
                  onClick={() => setShowDone(true)}
                  className="w-full min-h-[48px] rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  {t('agenda.secDone')} ({doneRanked.length}) +
                </button>
              );
            }
            return renderRow(it.b);
          })
        )}
      </div>

      {/* Back to now */}
      {view === 'timeline' && isToday && (
        <button
          onClick={scrollToNow}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 min-h-[48px] px-5 rounded-full bg-slate-900/95 backdrop-blur text-white text-[11px] font-black uppercase tracking-widest shadow-2xl transition-all active:scale-95 cursor-pointer flex items-center gap-2 z-20"
        >
          <Clock3 className="w-4 h-4" /> {t('agenda.backToNow')}
        </button>
      )}

      {/* Confirmation Modal */}
      {showModal && (
        <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl max-w-xs w-full animate-in zoom-in duration-200">
            <div className="flex items-center gap-4 mb-4 text-red-600">
              <div className="bg-red-50 p-2 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">{t('agenda.cancelHeading')}</h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              {t('agenda.cancelMsgPre')} <span className="font-bold text-slate-900 dark:text-white">{showModal.name}</span>{t('agenda.cancelMsgPost')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(null)}
                className="flex-1 px-4 min-h-[48px] rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {t('agenda.stay')}
              </button>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 px-4 min-h-[48px] rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {loading ? '...' : t('agenda.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
