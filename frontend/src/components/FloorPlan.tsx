import React, { useEffect, useState } from "react";
import { FLOOR_PLAN_DATA, type TableConfig } from "../utils/floorPlanData";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import { cn } from "../lib/utils";
import { useBookingsContext } from "../context/useBookingsContext";
import { Maximize2, Minimize2, Clock, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Booking } from "../types";

dayjs.extend(isBetween);

interface FloorPlanProps {
  hoveredBookingId: string | null;
  selectedDate: string;
  hideControls?: boolean;
}

export const FloorPlan: React.FC<FloorPlanProps> = ({
  hoveredBookingId,
  selectedDate,
  hideControls = false,
}) => {
  const { bookings: allBookings } = useBookingsContext();
  const [viewMode, setViewMode] = useState<'LIVE' | 'OVERVIEW'>('OVERVIEW');

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
      switch(status) {
          case "FREE": return "#22c55e";
          case "ONE_RES": return "#60a5fa";
          case "TWO_RES": return "#3b82f6";
          case "THREE_PLUS_RES": return "#1d4ed8";
          default: return "white";
      }
  }

  return (
    <div className={cn(
        "h-full flex flex-col transition-all duration-500 ease-in-out",
        isFullscreen ? "fixed inset-0 z-[110] bg-slate-50/95 backdrop-blur-2xl p-6" : "relative"
    )}>
      {!hideControls && (
        <div className="flex-none flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 mb-4 lg:mb-6 px-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 w-full lg:w-auto">
              <h2 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight flex items-center justify-between lg:justify-start gap-3 w-full lg:w-auto">
                Map View
                <div className="flex bg-slate-200/50 backdrop-blur-sm p-1 rounded-xl border border-slate-200/50">
                    <button onClick={() => setViewMode('LIVE')} className={cn("px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5", viewMode === 'LIVE' ? "bg-white shadow-md text-indigo-600" : "text-slate-500 hover:text-slate-900")}>
                        {viewMode === 'LIVE' && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></div>}
                        Live
                    </button>
                    <button onClick={() => setViewMode('OVERVIEW')} className={cn("px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer", viewMode === 'OVERVIEW' ? "bg-white shadow-md text-indigo-600" : "text-slate-500 hover:text-slate-900")}>
                        Overview
                    </button>
                </div>
              </h2>
          </div>

          <div className="flex flex-wrap items-center bg-white/80 backdrop-blur-md border border-slate-200 p-2.5 rounded-2xl gap-x-6 gap-y-2 shadow-sm">
              {viewMode === 'LIVE' ? (
                  <>
                    <div className="flex items-center gap-2.5 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                        <div className="w-3 h-3 rounded-md bg-emerald-500 shadow-sm shadow-emerald-500/30"></div> FREE
                    </div>
                    <div className="flex items-center gap-2.5 text-[10px] font-black text-amber-500 uppercase tracking-widest">
                        <div className="w-3 h-3 rounded-md bg-amber-400"></div> RES (30m)
                    </div>
                  </>
              ) : (
                  <>
                    <div className="flex items-center gap-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <div className="w-3 h-3 rounded-md bg-white border border-slate-300"></div> FREE
                    </div>
                    <div className="flex items-center gap-2.5 text-[10px] font-black text-blue-500 uppercase tracking-widest">
                        <div className="w-3 h-3 rounded-md bg-blue-300 border border-blue-400"></div> OCCUPIED
                    </div>
                  </>
              )}
              <div className="w-px h-4 bg-slate-200 mx-1 hidden sm:block"></div>
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
        className={cn(
            "flex-1 min-h-0 bg-white shadow-2xl border border-slate-200 overflow-hidden relative transition-all duration-500",
            isFullscreen ? "rounded-3xl" : "rounded-3xl lg:rounded-[2.5rem]"
        )}
        onMouseMove={(e) => {
          if ('ontouchstart' in window) return;
          const rect = e.currentTarget.getBoundingClientRect();
          setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
        onClick={() => setHoveredTable(null)}
      >
        <svg
          viewBox="-20 20 920 670"
          preserveAspectRatio="xMidYMin meet"
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
          </defs>
          <rect width="100%" height="100%" fill="url(#floorGrad)" />
          <rect width="100%" height="100%" fill="url(#grid)" />
          
          {FLOOR_PLAN_DATA.map((table) => {
            const status = getTableStatus(table.id);
            const count = getTableReservationCount(table.id);
            const tableBookings = bookings.filter((b: Booking) =>
              b.tables?.some((t: { name: string }) => t.name === table.id),
            );
            const isHighlighted = hoveredBookingId && tableBookings.some((b: Booking) => b.id === hoveredBookingId);
            const isHovered = hoveredTable === table.id;

            return (
              <g
                key={table.id}
                transform={`translate(${table.x}, ${table.y}) rotate(${table.rotation || 0}, ${table.width / 2}, ${table.height / 2}) scale(${isHovered || isHighlighted ? 1.05 : 1})`}
                onMouseEnter={() => setHoveredTable(table.id)}
                onMouseLeave={() => setHoveredTable(null)}
                className="cursor-pointer transition-all duration-300"
              >
                <path
                  d={getShapePath(table)}
                  fill={getColor(status)}
                  stroke={getStrokeColor(status, !!isHighlighted)}
                  strokeWidth={isHighlighted ? "4" : "2"}
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = (e.currentTarget.ownerSVGElement as any).getBoundingClientRect();
                    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                    setHoveredTable(prev => prev === table.id ? null : table.id);
                  }}
                />
                <text x={table.width / 2} y={table.height / 2} dy="0.35em" textAnchor="middle" fill={status === 'FREE' ? '#22c55e' : 'white'} fontSize="14" fontWeight="800" pointerEvents="none">
                  {table.id}
                </text>
                {viewMode === 'OVERVIEW' && count > 0 && (
                    <g transform={`translate(${table.width - 15}, -5)`}>
                         <circle cx="8" cy="8" r="8" fill="#ef4444" stroke="white" strokeWidth="2" />
                         <text x="8" y="8" dy="0.35em" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">{count}</text>
                    </g>
                )}
              </g>
            );
          })}
        </svg>

        <AnimatePresence>
          {hoveredTable && (
            <motion.div
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
                    <span className="text-xl font-black">Reservations</span>
                </div>
              </div>
              <div className="space-y-3">
                {bookings.filter((b: Booking) => b.tables?.some((t: { name: string }) => t.name === hoveredTable)).length === 0 ? (
                  <p className="text-xs text-slate-400">Available all day</p>
                ) : (
                  bookings.filter((b: Booking) => b.tables?.some((t: { name: string }) => t.name === hoveredTable)).map((b: Booking) => (
                    <div key={b.id} className="p-3 bg-white/5 rounded-xl border border-white/10 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-bold">{b.name}</p>
                        <p className="text-[10px] text-slate-400">{b.size} guests</p>
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
