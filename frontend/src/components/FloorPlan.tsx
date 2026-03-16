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
}

export const FloorPlan: React.FC<FloorPlanProps> = ({
  hoveredBookingId,
  selectedDate,
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
      // case "BAR":
      //   return `M ${width / 2}, 0 A ${width / 2} ${width / 2} 0 1,1 ${width / 2} ${width} A ${width / 2} ${width / 2} 0 1,1 ${width / 2} 0`;
      case "SQUARE":
        return `M 0 0 H ${width} V ${width} H 0 Z`;
      case "RECTANGULAR":
      default:
        return `M 0 0 H ${width} V ${height} H 0 Z`;
    }
  };

  const getColor = (status: string) => {
    switch (status) {
      case "RED":
        return "#ef4444";
      case "BLUE":
        return "#3b82f6";
      case "YELLOW":
        return "#eab308";
      case "GREEN":
        return "#22c55e";
      case "FREE":
        return "#ffffff";
      case "ONE_RES":
        return "#dbeafe";
      case "TWO_RES":
        return "#93c5fd";
      case "THREE_PLUS_RES":
        return "#3b82f6";
      default:
        return "#e5e7eb";
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
        isFullscreen ? "fixed inset-0 z-[100] bg-slate-50/95 backdrop-blur-2xl p-6" : "relative"
    )}>
      {/* Header + Legend — OUTSIDE the SVG container */}
      <div className="flex-none flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              Floor Plan
              <div className="flex bg-slate-200/50 backdrop-blur-sm p-1 rounded-xl border border-slate-200/50">
                  <button 
                      onClick={() => setViewMode('LIVE')} 
                      className={cn(
                          "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5", 
                          viewMode === 'LIVE' ? "bg-white shadow-md text-indigo-600" : "text-slate-500 hover:text-slate-900"
                      )}
                  >
                      {viewMode === 'LIVE' && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></div>}
                      Live
                  </button>
                  <button 
                      onClick={() => setViewMode('OVERVIEW')} 
                      className={cn(
                          "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer", 
                          viewMode === 'OVERVIEW' ? "bg-white shadow-md text-indigo-600" : "text-slate-500 hover:text-slate-900"
                      )}
                  >
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
                  <div className="flex items-center gap-2.5 text-[10px] font-black text-red-500 uppercase tracking-widest">
                      <div className="w-3 h-3 rounded-md bg-red-500"></div> OCCUPIED
                  </div>
                  <div className="flex items-center gap-2.5 text-[10px] font-black text-blue-500 uppercase tracking-widest">
                      <div className="w-3 h-3 rounded-md bg-blue-500"></div> SOON
                  </div>
                </>
            ) : (
                <>
                  <div className="flex items-center gap-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <div className="w-3 h-3 rounded-md bg-white border border-slate-300"></div> FREE
                  </div>
                  <div className="flex items-center gap-2.5 text-[10px] font-black text-blue-400 uppercase tracking-widest">
                      <div className="w-3 h-3 rounded-md bg-blue-100 border border-blue-200"></div> 1 RES
                  </div>
                  <div className="flex items-center gap-2.5 text-[10px] font-black text-blue-500 uppercase tracking-widest">
                      <div className="w-3 h-3 rounded-md bg-blue-300 border border-blue-400"></div> 2 RES
                  </div>
                  <div className="flex items-center gap-2.5 text-[10px] font-black text-blue-700 uppercase tracking-widest">
                      <div className="w-3 h-3 rounded-md bg-blue-600 border border-blue-700"></div> 3+ RES
                  </div>
                </>
            )}
            <div className="w-px h-4 bg-slate-200 mx-1 hidden sm:block"></div>
            <button 
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-indigo-600 cursor-pointer"
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
        </div>
      </div>

      {/* SVG container — takes ALL remaining space */}
      <div
        className={cn(
            "flex-1 min-h-0 bg-white shadow-2xl border border-slate-200 overflow-hidden relative transition-all duration-500",
            isFullscreen ? "rounded-3xl" : "rounded-3xl lg:rounded-[2.5rem]"
        )}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
      >
        <svg
          viewBox="-20 20 920 670"
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full bg-slate-50/30 cursor-grab active:cursor-grabbing"
        >
          <defs>
            <pattern
              id="grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="2" cy="2" r="1.5" fill="#cbd5e1" fillOpacity="0.4" />
            </pattern>
            <linearGradient id="floorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="100%" stopColor="#f1f5f9" />
            </linearGradient>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="0"
                dy="4"
                stdDeviation="6"
                floodColor="#000000"
                floodOpacity="0.08"
              />
            </filter>
          </defs>
          <rect width="100%" height="100%" fill="url(#floorGrad)" />
          <rect width="100%" height="100%" fill="url(#grid)" />
          
          <line x1="450" y1="0" x2="450" y2="700" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 8" opacity="0.3" />
          <line x1="0" y1="350" x2="900" y2="350" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 8" opacity="0.3" />

          {FLOOR_PLAN_DATA.map((table) => {
            const status = getTableStatus(table.id);
            const count = getTableReservationCount(table.id);
            const tableBookings = bookings.filter((b: Booking) =>
              b.tables?.some((t: { name: string }) => t.name === table.id),
            );
            const isHighlighted =
              hoveredBookingId &&
              tableBookings.some((b: Booking) => b.id === hoveredBookingId);
            const isHovered = hoveredTable === table.id;

            return (
              <g
                key={table.id}
                transform={`translate(${table.x}, ${table.y}) rotate(${table.rotation || 0}, ${table.width / 2}, ${table.height / 2}) scale(${isHovered || isHighlighted ? 1.05 : 1})`}
                onMouseEnter={() => setHoveredTable(table.id)}
                onMouseLeave={() => setHoveredTable(null)}
                className="cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
                style={{
                  filter: isHighlighted
                    ? "drop-shadow(0 0 15px rgba(79, 70, 229, 0.6))"
                    : "url(#shadow)",
                  transformBox: "fill-box",
                  transformOrigin: "center",
                }}
              >
                <path
                  d={getShapePath(table)}
                  fill={getColor(status)}
                  stroke={getStrokeColor(status, !!isHighlighted)}
                  strokeWidth={isHighlighted ? "4" : viewMode === 'OVERVIEW' ? "2" : "3"}
                  className="transition-all duration-300"
                />
                <text
                  x={table.width / 2}
                  y={table.height / 2}
                  dy="0.35em"
                  textAnchor="middle"
                  fill={viewMode === 'OVERVIEW' && status === 'FREE' ? '#22c55e' : 'white'}
                  fontSize="14"
                  fontWeight="800"
                  pointerEvents="none"
                  className="transition-all duration-300"
                  style={{ textShadow: "0px 1px 2px rgba(0,0,0,0.3)" }}
                >
                  {table.id}
                </text>

                {viewMode === 'OVERVIEW' && count > 0 && (
                    <g transform={`translate(${table.width - 20}, -5)`}>
                         <circle cx="10" cy="10" r="10" fill="#ef4444" stroke="white" strokeWidth="2" />
                         <text x="10" y="10" dy="0.35em" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">{count}</text>
                    </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Premium Tooltip with Framer Motion */}
        <AnimatePresence>
          {hoveredTable && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ 
                  opacity: 1, 
                  scale: 1, 
                  x: mousePos.x + 20,
                  y: mousePos.y + 20 + (mousePos.y > 260 ? -320 : 0) // Dynamic height adjustment
              }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ 
                  type: "spring", 
                  damping: 25, 
                  stiffness: 300,
                  opacity: { duration: 0.2 }
              }}
              className="absolute top-0 left-0 z-50 pointer-events-none bg-slate-900/95 backdrop-blur-2xl text-white p-5 rounded-[2rem] shadow-[0_25px_70px_rgba(0,0,0,0.4)] border border-white/10 min-w-64"
              style={{
                transformOrigin: "top left",
              }}
            >
              <div className="flex justify-between items-center mb-4">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] leading-none mb-1.5">Selected Table</span>
                    <span className="text-2xl font-black tracking-tight leading-none">Table {hoveredTable}</span>
                </div>
                <div className="px-3 py-1.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-xl text-[10px] font-black uppercase tracking-wider">
                  {viewMode}
                </div>
              </div>

              <div className="space-y-3">
                {bookings.filter((b: Booking) =>
                  b.tables?.some(
                    (t: { name: string }) => t.name === hoveredTable,
                  ),
                ).length === 0 ? (
                  <div className="py-6 border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest text-center">Available All Day</p>
                    <p className="text-[10px] text-slate-600 font-medium mt-1">No reservations</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {bookings
                      .filter((b: Booking) =>
                        b.tables?.some(
                          (t: { name: string }) => t.name === hoveredTable,
                        ),
                      )
                      .sort((a, b) => dayjs(a.startTime).diff(dayjs(b.startTime)))
                      .map((b: Booking) => {
                        const isCurrent = dayjs().isBetween(
                          dayjs(b.startTime),
                          dayjs(b.endTime),
                        );
                        return (
                          <div
                            key={b.id}
                            className={cn(
                              "p-3 rounded-2xl border transition-all duration-300 flex flex-col gap-2",
                              isCurrent
                                ? "bg-indigo-600 border-indigo-400 shadow-[0_10px_30px_rgba(79,70,229,0.3)] text-white"
                                : "bg-white/5 border-white/10 text-slate-300",
                            )}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-black leading-none tracking-tight">
                                {b.name}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3 h-3 opacity-50" />
                                <span className="text-[10px] font-black">{dayjs(b.startTime).format("HH:mm")}</span>
                              </div>
                            </div>
                            <div className={cn(
                              "text-[10px] font-bold flex justify-between items-center",
                              isCurrent ? "text-indigo-100" : "text-slate-500"
                            )}>
                              <div className="flex items-center gap-1.5">
                                <Users className="w-3 h-3" />
                                {b.size} guests
                              </div>
                              <span className="opacity-70 italic text-[9px]">until {dayjs(b.endTime).format("HH:mm")}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
{/* 
        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
          <button className="w-9 h-9 bg-white rounded-xl shadow-lg flex items-center justify-center text-slate-700 hover:bg-slate-50 font-bold transition-all active:scale-95 cursor-pointer">
            +
          </button>
          <button className="w-9 h-9 bg-white rounded-xl shadow-lg flex items-center justify-center text-slate-700 hover:bg-slate-50 font-bold transition-all active:scale-95 cursor-pointer">
            -
          </button>
        </div> */}
      </div>
    </div>
  );
};
