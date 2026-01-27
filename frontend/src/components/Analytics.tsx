import React from 'react';
import dayjs from 'dayjs';
import { useBookings } from '../hooks/useBookings';

interface AnalyticsProps {
  date: string;
}

export const Analytics: React.FC<AnalyticsProps> = ({ date }) => {
  const { bookings: allBookings } = useBookings();
  
  const bookingsForDay = allBookings.filter((b: any) => 
    dayjs(b.startTime).format('YYYY-MM-DD') === date
  );

  const totalBookings = bookingsForDay.length;
  const turnover = (totalBookings / 48).toFixed(1); // Rough occupancy metric
  const busySlot = '20:00'; // Placeholder logic

  const Card = ({ label, value, sub }: { label: string, value: string | number, sub?: string }) => (
    <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100 flex flex-col items-center justify-center hover:scale-105 transition-transform">
        <div className="text-3xl font-black text-slate-900 mb-1">{value}</div>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</div>
        {sub && <div className="text-xs text-emerald-500 font-bold mt-2">{sub}</div>}
    </div>
  );

  return (
    <div className="grid grid-cols-3 gap-4 mb-8">
       <Card label="Total Bookings" value={totalBookings} sub="+12% vs yesterday" />
       <Card label="Est. Turnover" value={turnover} />
       <Card label="Peak Hour" value={busySlot} />
    </div>
  );
};
