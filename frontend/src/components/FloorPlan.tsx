import React, { useEffect, useState } from "react";
import { FLOOR_PLAN_DATA, type TableConfig } from "../utils/floorPlanData";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import { cn } from "../lib/utils";
import { useBookingsContext } from "../context/useBookingsContext";
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
    (b: Booking) => dayjs(b.startTime).format("YYYY-MM-DD") === selectedDate,
  );
  const [currentTime, setCurrentTime] = useState(dayjs());
  const [hoveredTable, setHoveredTable] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

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
      case "BAR":
        return `M ${width / 2}, 0 A ${width / 2} ${width / 2} 0 1,1 ${width / 2} ${width} A ${width / 2} ${width / 2} 0 1,1 ${width / 2} 0`;
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
    <div className="h-full flex flex-col">
      {/* Header + Legend — OUTSIDE the SVG container */}
      <div className="flex-none flex justify-between items-center m-2">
        <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-900">
              Floor Plan
            </h2>
            <div className="flex bg-slate-100 p-0.5 rounded-lg">
                <button 
                    onClick={() => setViewMode('LIVE')} 
                    className={cn(
                        "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer", 
                        viewMode === 'LIVE' ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-900"
                    )}
                >
                    Live
                </button>
                <button 
                    onClick={() => setViewMode('OVERVIEW')} 
                    className={cn(
                        "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer", 
                        viewMode === 'OVERVIEW' ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-900"
                    )}
                >
                    Overview
                </button>
            </div>
        </div>

        {viewMode === 'LIVE' ? (
            <div className="flex gap-3 text-[10px] font-bold tracking-wide">
              <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div> AVAILABLE
              </div>
              <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div> RES (30m)
              </div>
              <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div> OCCUPIED
              </div>
              <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div> SOON
              </div>
            </div>
        ) : (
            <div className="flex gap-3 text-[10px] font-bold tracking-wide">
              <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full border-2 border-emerald-500 bg-white"></div> FREE
              </div>
              <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-100 border border-blue-300"></div> 1 RES
              </div>
              <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-300 border border-blue-500"></div> 2 RES
              </div>
              <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-blue-700"></div> 3+ RES
              </div>
            </div>
        )}
      </div>

      {/* SVG container — takes ALL remaining space */}
      <div
        className="flex-1 min-h-0 rounded-2xl border border-slate-100 overflow-hidden relative"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
      >
        <svg
          viewBox="-20 20 920 670"
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full bg-slate-50"
        >
          <defs>
            <pattern
              id="grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r="1" fill="#cbd5e1" />
            </pattern>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="2"
                dy="2"
                stdDeviation="3"
                floodColor="#000000"
                floodOpacity="0.1"
              />
            </filter>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

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

        {hoveredTable && (
          <div
            className="absolute top-0 left-0 z-50 pointer-events-none bg-slate-900/90 backdrop-blur-xl text-white p-5 rounded-4xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20 min-w-[240px] transition-opacity duration-300"
            style={{
              transform: `translate3d(${mousePos.x + 20}px, ${mousePos.y + 20}px, 0) ${mousePos.y > 260 ? "translateY(-120%)" : ""}`,
              opacity: hoveredTable ? 1 : 0,
            }}
          >
            <div className="flex justify-between items-center mb-4">
              <span className="text-xl font-black tracking-tight">
                Table {hoveredTable}
              </span>
              <span className="text-[10px] bg-indigo-500/30 text-indigo-300 border border-indigo-500/50 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">
                {viewMode} Mode
              </span>
            </div>

            <div className="space-y-3">
              {bookings.filter((b: Booking) =>
                b.tables?.some(
                  (t: { name: string }) => t.name === hoveredTable,
                ),
              ).length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-sm text-slate-400 font-bold italic">
                    No reservations
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium mt-1">
                    Available all day
                  </p>
                </div>
              ) : (
                bookings
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
                          "p-3 rounded-2xl border transition-all duration-300",
                          isCurrent
                            ? "bg-indigo-600 border-indigo-400 shadow-[0_0_20px_rgba(79,70,229,0.4)] text-white scale-[1.02]"
                            : "bg-white/5 border-white/10 text-slate-200",
                        )}
                      >
                        <div className="flex justify-between items-start mb-1.5">
                          <span className="text-sm font-black leading-tight tracking-tight">
                            {b.name}
                          </span>
                          <span
                            className={cn(
                              "text-[10px] font-black",
                              isCurrent ? "text-indigo-100" : "text-slate-500",
                            )}
                          >
                            {dayjs(b.startTime).format("HH:mm")}
                          </span>
                        </div>
                        <div
                          className={cn(
                            "text-[11px] font-bold flex justify-between",
                            isCurrent ? "text-indigo-200/80" : "text-slate-400",
                          )}
                        >
                          <span className="flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-current opacity-50"></span>
                            {b.size} guests
                          </span>
                          <span>ends {dayjs(b.endTime).format("HH:mm")}</span>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}
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
