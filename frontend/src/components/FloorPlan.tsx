import React, { useEffect, useState } from 'react';
import { FLOOR_PLAN_DATA, type TableConfig } from '../utils/floorPlanData';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { useBookings } from '../hooks/useBookings';
import { cn } from '../lib/utils';

dayjs.extend(isBetween);

interface FloorPlanProps {
  hoveredBookingId: string | null;
  selectedDate: string;
}

export const FloorPlan: React.FC<FloorPlanProps> = ({ hoveredBookingId, selectedDate }) => {
  const { bookings: allBookings } = useBookings();
  const bookings = allBookings.filter((b: any) => dayjs(b.startTime).format('YYYY-MM-DD') === selectedDate);
  const [currentTime, setCurrentTime] = useState(dayjs());
  const [hoveredTable, setHoveredTable] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(dayjs());
    }, 60000); // Update every minute

    return () => {
      clearInterval(interval);
    };
  }, []);

  const getTableStatus = (tableId: string) => {
    const tableBookings = bookings.filter((b: any) => b.tables?.some((t: any) => t.name === tableId));
    const now = currentTime;

    for (const booking of tableBookings) {
      if (booking.status === 'CANCELLED') continue;
      const start = dayjs(booking.startTime);
      const end = dayjs(booking.endTime);

      if (now.isAfter(start) && now.isBefore(end.subtract(30, 'minute'))) {
        return 'RED';
      }
      
      if (now.isAfter(end.subtract(30, 'minute')) && now.isBefore(end)) {
        return 'BLUE';
      }

      if (start.isAfter(now) && start.diff(now, 'minute') < 30) {
        return 'YELLOW';
      }
    }

    return 'GREEN';
  };

  const getShapePath = (table: TableConfig) => {
    const { width, height, shape } = table;
    switch (shape) {
      case 'OCTAGONAL':
        const corner = Math.min(width, height) * 0.3;
        return `M ${corner} 0 H ${width - corner} L ${width} ${corner} V ${height - corner} L ${width - corner} ${height} H ${corner} L 0 ${height - corner} V ${corner} Z`;
      case 'ROUND':
        return `M ${width/2}, 0 A ${width/2} ${height/2} 0 1,1 ${width/2} ${height} A ${width/2} ${height/2} 0 1,1 ${width/2} 0`;
      case 'CAPSULE':
        const r = Math.min(width, height) / 2;
        if (width > height) {
           return `M ${r} 0 H ${width - r} A ${r} ${r} 0 0 1 ${width - r} ${height} H ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
        } else {
           return `M 0 ${r} V ${height - r} A ${r} ${r} 0 0 0 ${width} ${height - r} V ${r} A ${r} ${r} 0 0 0 0 ${r} Z`;
        }
      case 'BAR':
        return `M ${width / 2}, 0 A ${width / 2} ${width / 2} 0 1,1 ${width / 2} ${width} A ${width / 2} ${width / 2} 0 1,1 ${width / 2} 0`;
      case 'SQUARE':
        return `M 0 0 H ${width} V ${width} H 0 Z`;
      case 'RECTANGULAR':
      default:
        return `M 0 0 H ${width} V ${height} H 0 Z`;
    }
  };

  const getColor = (status: string) => {
    switch (status) {
      case 'RED': return '#ef4444';
      case 'BLUE': return '#3b82f6';
      case 'YELLOW': return '#eab308';
      case 'GREEN': return '#22c55e';
      default: return '#e5e7eb';
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Floor Plan <span className="text-sm font-normal text-slate-400 ml-2">Live View</span></h2>
        <div className="flex gap-4 text-xs font-bold tracking-wide">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></div> AVAILABLE</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-400 shadow-sm shadow-yellow-400/50"></div> RES (30m)</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500 shadow-sm shadow-red-500/50"></div> OCCUPIED</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50"></div> SOON AVAILABLE</div>
        </div>
      </div>
      
      <div 
        className="flex-1 bg-white rounded-3xl shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden relative"
        onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
      >
        <svg width="100%" height="100%" viewBox="0 0 1000 800" className="w-full h-full bg-slate-50">
           <defs>
             <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
               <circle cx="1" cy="1" r="1" fill="#cbd5e1" />
             </pattern>
             <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
               <feDropShadow dx="2" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.1" />
             </filter>
           </defs>
           <rect width="100%" height="100%" fill="url(#grid)" />

           {FLOOR_PLAN_DATA.map((table) => {
             const status = getTableStatus(table.id);
             const tableBookings = bookings.filter((b: any) => b.tables?.some((t: any) => t.name === table.id));
             const isHighlighted = hoveredBookingId && tableBookings.some((b: any) => b.id === hoveredBookingId);

             return (
               <g 
                 key={table.id} 
                 transform={`translate(${table.x}, ${table.y}) rotate(${table.rotation || 0}, ${table.width/2}, ${table.height/2})`}
                 onMouseEnter={() => setHoveredTable(table.id)}
                 onMouseLeave={() => setHoveredTable(null)}
                 className="cursor-pointer transition-all duration-300"
                 style={{ filter: isHighlighted ? 'drop-shadow(0 0 12px rgba(79, 70, 229, 0.8))' : 'url(#shadow)' }}
               >
                 <path 
                   d={getShapePath(table)} 
                   fill={getColor(status)} 
                   stroke={isHighlighted ? "#4f46e5" : "white"} 
                   strokeWidth={isHighlighted ? "4" : "3"}
                   className="transition-all duration-500"
                 />
                 <text 
                   x={table.width / 2} 
                   y={table.height / 2} 
                   dy="0.35em" 
                   textAnchor="middle" 
                   fill="white" 
                   fontSize="14" 
                   fontWeight="800"
                   pointerEvents="none"
                   style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.3)' }}
                 >
                   {table.id}
                 </text>
               </g>
             );
           })}
        </svg>
        
        {hoveredTable && (
            <div 
                className="absolute z-50 pointer-events-none bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-white/10 animate-in fade-in zoom-in duration-200 min-w-[220px]"
                style={{ 
                    left: `${mousePos.x + 20}px`, 
                    top: `${mousePos.y + 20}px`,
                    transform: mousePos.x > 750 ? 'translateX(-110%)' : 'none'
                }}
            >
                <div className="flex justify-between items-center mb-3">
                    <span className="text-lg font-black tracking-tight">Table {hoveredTable}</span>
                    <span className="text-[9px] bg-indigo-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Live info</span>
                </div>
                
                <div className="space-y-2">
                    {bookings.filter((b: any) => b.tables?.some((t: any) => t.name === hoveredTable)).length === 0 ? (
                        <p className="text-xs text-slate-400 font-medium italic">No reservations today</p>
                    ) : (
                        bookings
                            .filter((b: any) => b.tables?.some((t: any) => t.name === hoveredTable))
                            .sort((a, b) => dayjs(a.startTime).diff(dayjs(b.startTime)))
                            .map((b: any) => {
                                const isCurrent = dayjs().isBetween(dayjs(b.startTime), dayjs(b.endTime));
                                return (
                                    <div key={b.id} className={cn(
                                        "p-2.5 rounded-xl border transition-colors",
                                        isCurrent ? "bg-indigo-600 border-indigo-400 text-white" : "bg-white/5 border-white/10 text-slate-200"
                                    )}>
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-xs font-bold leading-tight">{b.guestName}</span>
                                            <span className={cn("text-[10px] font-black", isCurrent ? "text-indigo-100" : "text-slate-500")}>
                                                {dayjs(b.startTime).format('HH:mm')}
                                            </span>
                                        </div>
                                        <div className={cn("text-[10px] font-medium flex justify-between", isCurrent ? "text-indigo-200" : "text-slate-400")}>
                                            <span>{b.size} guests</span>
                                            <span>{dayjs(b.endTime).format('HH:mm')} end</span>
                                        </div>
                                    </div>
                                );
                            })
                    )}
                </div>
            </div>
        )}

        <div className="absolute bottom-6 right-6 flex flex-col gap-2">
            <button className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center text-slate-700 hover:bg-slate-50 font-bold">+</button>
            <button className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center text-slate-700 hover:bg-slate-50 font-bold">-</button>
        </div>
      </div>
    </div>
  );
};
