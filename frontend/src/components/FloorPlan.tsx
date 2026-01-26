import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { FLOOR_PLAN_DATA, type TableConfig } from '../utils/floorPlanData';
import dayjs from 'dayjs';

const socket = io('http://localhost:3000');

interface Booking {
  id: string;
  tableId: number; // Note: Prisma int vs String id mapping
  startTime: string;
  endTime: string;
  guestName: string;
  size: number;
}

export const FloorPlan: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [currentTime, setCurrentTime] = useState(dayjs());

  useEffect(() => {
    // Initial fetch
    fetch('http://localhost:3000/api/bookings')
      .then(res => res.json())
      .then((data: any[]) => {
        // Map Prisma Table ID (int) to String ID used in frontend if needed
        // Our seeds used names "1", "10" matching the IDs.
        // But tableId in Booking is the auto-inc INT ID.
        // We need to fetch tables to map ID -> Name if they differ.
        // For now, let's assume the backend returns the table relation or we fetch tables.
        // In server.ts: include: { table: true }
        // So we have booking.table.name which matches our FLOOR_PLAN_DATA ids.
        setBookings(data);
      });

    // Socket listeners
    socket.on('booking-update', (payload: { type: string, booking: Booking }) => {
      // Optimistic/Simple update: just refetch or append
      // For simplicity, let's refetch or append
      setBookings(prev => [...prev, payload.booking]);
    });

    const interval = setInterval(() => {
      setCurrentTime(dayjs());
    }, 60000); // Update every minute

    return () => {
      socket.off('booking-update');
      clearInterval(interval);
    };
  }, []);

  const getTableStatus = (tableId: string) => {
    // Filter bookings for this table
    const tableBookings = bookings.filter((b: any) => b.table.name === tableId);
    
    // Check status
    // Priority: Red (Occupied) -> Orange (Overstay) -> Yellow (Reserved soon) -> Green
    // Actually Orange (Overstay) is worse than Occupied?
    // "Occupied (Active)" vs "Overstaying (Past limit)".
    
    // Sort by time?
    const now = currentTime;

    for (const booking of tableBookings) {
      const start = dayjs(booking.startTime);
      const end = dayjs(booking.endTime);

      // RED: Occupied (Start <= Now <= End)
      if (now.isAfter(start) && now.isBefore(end)) {
        return 'RED';
      }
      
      // ORANGE: Overstaying (Now > End) - Assuming we track "active" bookings.
      // If a booking ended 5 mins ago, is it overstaying? Yes.
      // If it ended 5 hours ago? Probably not relevant.
      // Let's say if End < Now < End + 30 mins, it's Orange.
      if (now.isAfter(end) && now.diff(end, 'minute') < 30) {
        return 'ORANGE';
      }

      // YELLOW: Reserved (Starts within 30 mins)
      // Start > Now && Start - Now < 30
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
        // Simplified octagonal path or just using CSS clip-path usually, but SVG path is better
        // Octagon: 8 sides.
        const corner = Math.min(width, height) * 0.3;
        return `M ${corner} 0 H ${width - corner} L ${width} ${corner} V ${height - corner} L ${width - corner} ${height} H ${corner} L 0 ${height - corner} V ${corner} Z`;
      case 'ROUND':
        return `M ${width/2}, 0 A ${width/2} ${height/2} 0 1,1 ${width/2} ${height} A ${width/2} ${height/2} 0 1,1 ${width/2} 0`; // Ellipse
      case 'CAPSULE':
        const r = Math.min(width, height) / 2;
        if (width > height) {
           // Horizontal capsule
           return `M ${r} 0 H ${width - r} A ${r} ${r} 0 0 1 ${width - r} ${height} H ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
        } else {
           // Vertical capsule
           return `M 0 ${r} V ${height - r} A ${r} ${r} 0 0 0 ${width} ${height - r} V ${r} A ${r} ${r} 0 0 0 0 ${r} Z`;
        }
      case 'BAR':
        // Circle for stool
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
      case 'RED': return '#ef4444'; // Red-500
      case 'ORANGE': return '#f97316'; // Orange-500
      case 'YELLOW': return '#eab308'; // Yellow-500
      case 'GREEN': return '#22c55e'; // Green-500
      default: return '#e5e7eb'; // Gray-200
    }
  };

// ...
  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Floor Plan <span className="text-sm font-normal text-slate-400 ml-2">Live View</span></h2>
        <div className="flex gap-4 text-xs font-bold tracking-wide">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></div> AVAILABLE</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-400 shadow-sm shadow-yellow-400/50"></div> RES (30m)</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500 shadow-sm shadow-red-500/50"></div> OCCUPIED</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500 shadow-sm shadow-orange-500/50"></div> OVERSTAY</div>
        </div>
      </div>
      
      <div className="flex-1 bg-white rounded-3xl shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden relative">
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
             return (
               <g 
                 key={table.id} 
                 transform={`translate(${table.x}, ${table.y}) rotate(${table.rotation || 0}, ${table.width/2}, ${table.height/2})`}
                 onClick={() => alert(`Table ${table.id} Status: ${status}`)}
                 className="cursor-pointer hover:opacity-90 transition-all duration-300"
                 style={{ filter: 'url(#shadow)' }}
               >
                 <path 
                   d={getShapePath(table)} 
                   fill={getColor(status)} 
                   stroke="white" 
                   strokeWidth="3"
                   className="transition-fill duration-500"
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
        
        {/* Floating Zoom Controls (Mock) */}
        <div className="absolute bottom-6 right-6 flex flex-col gap-2">
            <button className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center text-slate-700 hover:bg-slate-50 font-bold">+</button>
            <button className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center text-slate-700 hover:bg-slate-50 font-bold">-</button>
        </div>
      </div>
    </div>
  );
};
