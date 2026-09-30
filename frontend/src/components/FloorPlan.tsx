import React, { useEffect, useState } from "react";
import { type TableConfig } from "../utils/floorPlanData";
import { useLayoutTables } from "../hooks/useFloorPlan";
import { useTranslation } from "../i18n/useTranslation";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import { cn } from "../lib/utils";
import { useBookingsContext } from "../context/useBookingsContext";
import { Maximize2, Minimize2, X, Check } from "lucide-react";
import { TableSheet } from "./TableSheet";
import { motion, AnimatePresence } from "framer-motion";
import type { Booking } from "../types";

dayjs.extend(isBetween);

interface FloorPlanProps {
  hoveredBookingId: string | null;
  selectedDate: string;
  hideControls?: boolean;
  initialViewMode?: 'LIVE' | 'OVERVIEW';
  /** Booking ids matched by the host command bar — their tables glow. */
  highlightBookingIds?: string[];
  /** When set, the map enters placement mode for this booking. */
  placementBooking?: Booking | null;
  /** Persist the tapped tables; andCheckIn also checks the guest in. */
  onPlacementSave?: (bookingId: string, tableNames: string[], andCheckIn: boolean) => Promise<void>;
  onPlacementCancel?: () => void;
  /** Table tapped by the host (action sheet). Null = closed. */
  selectedTableId?: string | null;
  onSelectTable?: (id: string | null) => void;
  /** Jump to the arrivals list filtered on a guest name. */
  onFocusBooking?: (name: string) => void;
  /** Open a quick-résa prefilled for a table. */
  onQuickCreate?: (tableId: string) => void;
}

export const FloorPlan: React.FC<FloorPlanProps> = ({
  hoveredBookingId,
  selectedDate,
  hideControls = false,
  initialViewMode = 'OVERVIEW',
  highlightBookingIds = [],
  placementBooking = null,
  onPlacementSave,
  onPlacementCancel,
  selectedTableId = null,
  onSelectTable,
  onFocusBooking,
  onQuickCreate,
}) => {
  const { bookings: allBookings } = useBookingsContext();
  const { t } = useTranslation();
  const { tables: layoutTables } = useLayoutTables();
  const [viewMode, setViewMode] = useState<'LIVE' | 'OVERVIEW'>(initialViewMode);
  const [tempTables, setTempTables] = useState<string[]>([]);
  const [placing, setPlacing] = useState(false);

  // Fresh selection whenever a new booking enters placement mode.
  useEffect(() => {
    setTempTables(placementBooking ? placementBooking.tables.map(tbl => tbl.name) : []);
  }, [placementBooking]);

  const bookings = allBookings.filter(
    (b: Booking) =>
      dayjs(b.startTime).format("YYYY-MM-DD") === selectedDate &&
      b.status !== 'CANCELLED',
  );
  const [currentTime, setCurrentTime] = useState(dayjs());
  const [hoveredTable, setHoveredTable] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(dayjs());
    }, 60000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const getTableReservationCount = (tableId: string) => {
    return bookings.filter((b: Booking) =>
      b.tables?.some((t: { name: string }) => t.name === tableId) && b.status !== 'CANCELLED'
    ).length;
  };

  // ── Inline placement (replaces the old /app/assign page) ──
  const MAX_BOOKINGS_PER_TABLE = 3;

  /** Other bookings overlapping the placement window on a table (15 min buffer). */
  const countOverlapping = (tableId: string) => {
    if (!placementBooking) return 0;
    const reqStart = dayjs(placementBooking.startTime);
    const reqEnd = dayjs(placementBooking.endTime);
    return bookings.filter(b => {
      if (b.id === placementBooking.id || b.status === 'CANCELLED') return false;
      const s = dayjs(b.startTime);
      const e = dayjs(b.endTime);
      return (
        s.isBefore(reqEnd.add(15, 'minute')) &&
        e.isAfter(reqStart.subtract(15, 'minute')) &&
        b.tables?.some(tbl => tbl.name === tableId)
      );
    }).length;
  };

  const togglePlacementTable = (tableId: string) => {
    if (!placementBooking) return;
    if (countOverlapping(tableId) >= MAX_BOOKINGS_PER_TABLE && !tempTables.includes(tableId)) return;
    setTempTables(prev => (prev.includes(tableId) ? prev.filter(x => x !== tableId) : [...prev, tableId]));
  };

  const runPlacementSave = async (andCheckIn: boolean) => {
    if (!placementBooking || !onPlacementSave || placing) return;
    setPlacing(true);
    try {
      await onPlacementSave(placementBooking.id, tempTables, andCheckIn);
    } finally {
      setPlacing(false);
    }
  };

  const getTableStatus = (tableId: string) => {
    if (viewMode === 'OVERVIEW') {
      const count = getTableReservationCount(tableId);
      if (count === 0) return "FREE";
      if (count === 1) return "ONE_RES";
      if (count === 2) return "TWO_RES";
      return "THREE_PLUS_RES";
    }

    const tableBookings = bookings.filter((b: Booking) =>
      b.tables?.some((t: { name: string }) => t.name === tableId),
    );
    const now = currentTime;

    for (const booking of tableBookings) {
      if (booking.status === "CANCELLED") continue;
      const start = dayjs(booking.startTime);
      const end = dayjs(booking.endTime);

      if (now.isAfter(start) && now.isBefore(end.subtract(30, "minute"))) {
        return "RED";
      }

      if (now.isAfter(end.subtract(30, "minute")) && now.isBefore(end)) {
        return "BLUE";
      }

      if (start.isAfter(now) && start.diff(now, "minute") < 30) {
        return "YELLOW";
      }
    }

    return "GREEN";
  };

  const getShapePath = (table: TableConfig) => {
    const { width, height, shape } = table;
    switch (shape) {
      case "OCTAGONAL": {
        const corner = Math.min(width, height) * 0.3;
        return `M ${corner} 0 H ${width - corner} L ${width} ${corner} V ${height - corner} L ${width - corner} ${height} H ${corner} L 0 ${height - corner} V ${corner} Z`;
      }
      case "ROUND":
        return `M ${width / 2}, 0 A ${width / 2} ${height / 2} 0 1,1 ${width / 2} ${height} A ${width / 2} ${height / 2} 0 1,1 ${width / 2} 0`;
      case "CAPSULE": {
        const r = Math.min(width, height) / 2;
        if (width > height) {
          return `M ${r} 0 H ${width - r} A ${r} ${r} 0 0 1 ${width - r} ${height} H ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
        } else {
          return `M 0 ${r} V ${height - r} A ${r} ${r} 0 0 0 ${width} ${height - r} V ${r} A ${r} ${r} 0 0 0 0 ${r} Z`;
        }
      }
      case "SQUARE":
        return `M 0 0 H ${width} V ${width} H 0 Z`;
      case "RECTANGULAR":
      default:
        return `M 0 0 H ${width} V ${height} H 0 Z`;
    }
  };

  const getColor = (status: string) => {
    switch (status) {
      case "RED": return "#ef4444";
      case "BLUE": return "#3b82f6";
      case "YELLOW": return "#eab308";
      case "GREEN": return "#22c55e";
      case "FREE": return "#ffffff";
      case "ONE_RES": return "#dbeafe";
      case "TWO_RES": return "#93c5fd";
      case "THREE_PLUS_RES": return "#3b82f6";
      default: return "#e5e7eb";
    }
  };

  const getStrokeColor = (status: string, isHighlighted: boolean) => {
    if (isHighlighted) return "#4f46e5";
    switch (status) {
      case "FREE": return "#22c55e";
      case "ONE_RES": return "#60a5fa";
      case "TWO_RES": return "#3b82f6";
      case "THREE_PLUS_RES": return "#1d4ed8";
      default: return "white";
    }
  }

  return (
    <div className={cn(
      "h-full flex flex-col gap-4 p-4 lg:p-5 transition-all duration-500 ease-in-out",
      isFullscreen ? "fixed inset-0 z-[110] bg-slate-50/95 backdrop-blur-2xl p-6" : "relative"
    )}>
      {!hideControls && (
        <div className="flex-none flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
              {t('mapview.title')}
            </h2>
            <div className="flex bg-slate-200/50 backdrop-blur-sm p-1 rounded-xl border border-slate-200/50">
                <button onClick={() => setViewMode('LIVE')} className={cn("px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5", viewMode === 'LIVE' ? "bg-white shadow-md text-indigo-600" : "text-slate-500 hover:text-slate-900")}>
                  {viewMode === 'LIVE' && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></div>}
                  {t('mapview.live')}
                </button>
                <button onClick={() => setViewMode('OVERVIEW')} className={cn("px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer", viewMode === 'OVERVIEW' ? "bg-white shadow-md text-indigo-600" : "text-slate-500 hover:text-slate-900")}>
                  {t('mapview.overview')}
                </button>
            </div>
          </div>

          <div className="flex items-center bg-white/80 backdrop-blur-md border border-slate-200 px-4 py-2 rounded-2xl gap-4 shadow-sm">
            {viewMode === 'LIVE' ? (
              <>
                <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                  <div className="w-3 h-3 rounded-md bg-emerald-500 shadow-sm shadow-emerald-500/30"></div> {t('mapview.free')}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black text-amber-500 uppercase tracking-widest">
                  <div className="w-3 h-3 rounded-md bg-amber-400"></div> {t('mapview.resSoon')}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <div className="w-3 h-3 rounded-md bg-white border border-slate-300"></div> {t('mapview.free')}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black text-blue-500 uppercase tracking-widest">
                  <div className="w-3 h-3 rounded-md bg-blue-300 border border-blue-400"></div> {t('mapview.occupied')}
                </div>
              </>
            )}
            <div className="w-px h-4 bg-slate-200"></div>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-indigo-600 cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      <div
        className="flex-1 min-h-0 overflow-hidden relative transition-all duration-500"
        onMouseMove={(e) => {
          if ('ontouchstart' in window) return;
          const rect = e.currentTarget.getBoundingClientRect();
          setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
        onClick={() => {
          setHoveredTable(null);
          onSelectTable?.(null);
        }}
      >
        <svg
          viewBox="0 0 1000 800"
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full bg-slate-50/30 cursor-grab active:cursor-grabbing"
        >
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="#cbd5e1" fillOpacity="0.4" />
            </pattern>
            <linearGradient id="floorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="100%" stopColor="#f1f5f9" />
            </linearGradient>
            <clipPath id="mapCanvasClip">
              <rect x="0" y="0" width="1000" height="800" />
            </clipPath>
          </defs>
          <rect width="100%" height="100%" fill="url(#floorGrad)" />
          <rect width="100%" height="100%" fill="url(#grid)" />
          {/* Vector-only map: tables stay clipped to the 1000x800 canvas
              while the decorative fond fills the whole viewport. */}

          <g clipPath="url(#mapCanvasClip)">
          {layoutTables.map((table) => {
            const status = getTableStatus(table.id);
            const count = getTableReservationCount(table.id);
            const tableBookings = bookings.filter((b: Booking) =>
              b.tables?.some((t: { name: string }) => t.name === table.id),
            );
            const isHighlighted =
              (!!hoveredBookingId && tableBookings.some((b: Booking) => b.id === hoveredBookingId)) ||
              highlightBookingIds.some(id => tableBookings.some((b: Booking) => b.id === id));
            const isHovered = hoveredTable === table.id;
            const isPlacement = !!placementBooking;
            const overlap = isPlacement ? countOverlapping(table.id) : 0;
            const isFull = overlap >= MAX_BOOKINGS_PER_TABLE;
            const isChosen = isPlacement && tempTables.includes(table.id);
            const fitsParty = (table.seats ?? 2) >= (placementBooking?.size ?? 0);
            const fill = isPlacement
              ? isChosen ? '#4f46e5' : isFull ? '#e2e8f0' : fitsParty ? '#dcfce7' : '#fef3c7'
              : getColor(status);
            const stroke = isPlacement
              ? isChosen ? '#3730a3' : isFull ? '#94a3b8' : fitsParty ? '#22c55e' : '#f59e0b'
              : getStrokeColor(status, isHighlighted);
            const labelFill = isPlacement
              ? isChosen ? 'white' : '#334155'
              : status === 'FREE' ? '#22c55e' : 'white';

            return (
              <g
                key={table.id}
                transform={`translate(${table.x}, ${table.y}) rotate(${table.rotation || 0}, ${table.width / 2}, ${table.height / 2}) scale(${isHovered || isHighlighted || isChosen ? 1.05 : 1})`}
                onMouseEnter={() => setHoveredTable(table.id)}
                onMouseLeave={() => setHoveredTable(null)}
                className="cursor-pointer transition-all duration-300"
              >
                <path
                  d={getShapePath(table)}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isHighlighted || isChosen ? "4" : "2"}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isPlacement) {
                      togglePlacementTable(table.id);
                      return;
                    }
                    // Tap = host action sheet (hover tooltip stays desktop-only).
                    onSelectTable?.(selectedTableId === table.id ? null : table.id);
                  }}
                />
                <text x={table.width / 2} y={table.height / 2} dy="0.35em" textAnchor="middle" fill={labelFill} fontSize="16" fontWeight="800" pointerEvents="none">
                  {table.id}
                </text>
                {!isPlacement && viewMode === 'OVERVIEW' && count > 0 && (
                  <g transform={`translate(${table.width - 15}, -5)`}>
                    <circle cx="8" cy="8" r="8" fill="#ef4444" stroke="white" strokeWidth="2" />
                    <text x="8" y="8" dy="0.35em" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">{count}</text>
                  </g>
                )}
                {isPlacement && isChosen && (
                  <g transform={`translate(${table.width - 15}, -5)`}>
                    <circle cx="8" cy="8" r="9" fill="#4f46e5" stroke="white" strokeWidth="2" />
                    <text x="8" y="8" dy="0.35em" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">✓</text>
                  </g>
                )}
              </g>
            );
          })}
          </g>
        </svg>

        {/* Placement dock: confirm tapped tables without leaving the map. */}
        {placementBooking && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-slate-900/95 backdrop-blur-xl text-white pl-4 pr-2 py-2 rounded-2xl shadow-2xl border border-white/10 max-w-[calc(100%-2rem)]">
            <div className="min-w-0 mr-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300 leading-none mb-1">
                {t('placement.title')}
              </p>
              <p className="text-sm font-black truncate">
                {placementBooking.name} · {t('mapview.guestsFmt').replace('{n}', String(placementBooking.size))} ·{' '}
                {tempTables.length > 0 ? tempTables.join(', ') : '—'}
              </p>
            </div>
            <button
              onClick={() => runPlacementSave(false)}
              disabled={placing}
              className="h-11 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer disabled:opacity-50 shrink-0"
            >
              {t('placement.save')}
            </button>
            <button
              onClick={() => runPlacementSave(true)}
              disabled={placing || tempTables.length === 0}
              className="h-11 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
            >
              <Check className="w-4 h-4" /> {t('placement.seat')}
            </button>
            <button
              onClick={() => onPlacementCancel?.()}
              aria-label="Cancel"
              className="p-2.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Host action sheet for the tapped table. */}
        {selectedTableId && (() => {
          const cfg = layoutTables.find(tbl => tbl.id === selectedTableId);
          if (!cfg) return null;
          return (
            <TableSheet
              tableId={selectedTableId}
              seats={cfg.seats ?? 2}
              date={selectedDate}
              onClose={() => onSelectTable?.(null)}
              onFocusBooking={name => onFocusBooking?.(name)}
              onQuickCreate={id => onQuickCreate?.(id)}
            />
          );
        })()}

        <AnimatePresence>
          {hoveredTable && hoveredTable !== selectedTableId && (            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{
                opacity: 1,
                scale: 1,
                x: Math.min(mousePos.x + 20, window.innerWidth - 280),
                y: Math.min(mousePos.y + 20, window.innerHeight - 300) + (mousePos.y > 260 ? -320 : 0)
              }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute top-0 left-0 z-50 pointer-events-none bg-slate-900/95 backdrop-blur-2xl text-white p-5 rounded-[2rem] shadow-2xl border border-white/10 min-w-64"
            >
              <div className="flex justify-between items-center mb-4">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Table {hoveredTable}</span>
                  <span className="text-xl font-black">{t('mapview.reservations')}</span>
                </div>
              </div>
              <div className="space-y-3">
                {bookings.filter((b: Booking) => b.tables?.some((t: { name: string }) => t.name === hoveredTable)).length === 0 ? (
                  <p className="text-xs text-slate-400">{t('mapview.availAllDay')}</p>
                ) : (
                  bookings.filter((b: Booking) => b.tables?.some((t: { name: string }) => t.name === hoveredTable)).map((b: Booking) => (
                    <div key={b.id} className="p-3 bg-white/5 rounded-xl border border-white/10 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-bold">{b.name}</p>
                        <p className="text-[10px] text-slate-400">{t('mapview.guestsFmt').replace('{n}', String(b.size))}</p>
                      </div>
                      <p className="text-xs font-black">{dayjs(b.startTime).format("HH:mm")}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
