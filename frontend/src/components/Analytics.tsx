import React, { useEffect, useState } from 'react';

export const Analytics: React.FC = () => {
  const [stats, setStats] = useState({
    totalBookings: 0,
    busySlot: '19:00',
    turnover: '0.0'
  });

  useEffect(() => {
    fetch('http://localhost:3000/api/bookings')
      .then(res => res.json())
      .then((data: any[]) => {
        setStats({
          totalBookings: data.length,
          busySlot: '20:00',
          turnover: (data.length / 48).toFixed(1)
        });
      });
  }, []);

  const Card = ({ label, value, sub }: { label: string, value: string | number, sub?: string }) => (
    <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100 flex flex-col items-center justify-center hover:scale-105 transition-transform">
        <div className="text-3xl font-black text-slate-900 mb-1">{value}</div>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</div>
        {sub && <div className="text-xs text-emerald-500 font-bold mt-2">{sub}</div>}
    </div>
  );

  return (
    <div className="grid grid-cols-3 gap-4 mb-8">
       <Card label="Total Bookings" value={stats.totalBookings} sub="+12% vs yesterday" />
       <Card label="Est. Turnover" value={stats.turnover} />
       <Card label="Peak Hour" value={stats.busySlot} />
    </div>
  );
};
