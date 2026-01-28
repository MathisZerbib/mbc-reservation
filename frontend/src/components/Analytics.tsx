import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

interface AnalyticsProps {
  date: string;
}

export const Analytics: React.FC<AnalyticsProps> = ({ date }) => {
  const [data, setData] = useState<{
    totalBookings: number;
    turnover: number;
    peakHour: string;
    growth: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const result = await api.getAnalytics(date);
      setData(result);
    } catch (e) {
      console.error('Failed to fetch analytics', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();

    socket.on('booking-update', fetchAnalytics);
    return () => {
      socket.off('booking-update', fetchAnalytics);
    };
  }, [date]);

  const Card = ({ label, value, sub, loading }: { label: string, value: string | number, sub?: string, loading?: boolean }) => (
    <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100 flex flex-col items-center justify-center hover:scale-105 transition-transform min-h-[140px]">
        {loading ? (
            <div className="animate-pulse flex flex-col items-center">
                <div className="h-8 w-16 bg-slate-100 rounded mb-2"></div>
                <div className="h-3 w-24 bg-slate-50 rounded"></div>
            </div>
        ) : (
            <>
                <div className="text-3xl font-black text-slate-900 mb-1">{value}</div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</div>
                {sub && <div className="text-xs text-emerald-500 font-bold mt-2">{sub}</div>}
            </>
        )}
    </div>
  );

  return (
    <div className="grid grid-cols-3 gap-4 mb-8">
       <Card 
            label="Total Bookings" 
            value={data?.totalBookings ?? 0} 
            sub={data?.growth} 
            loading={loading}
        />
       <Card 
            label="Est. Turnover" 
            value={data ? `${data.turnover}€` : '0€'} 
            loading={loading}
        />
       <Card 
            label="Peak Hour" 
            value={data?.peakHour ?? '--:--'} 
            loading={loading}
        />
    </div>
  );
};
