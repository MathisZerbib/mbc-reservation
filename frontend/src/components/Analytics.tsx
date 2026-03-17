import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { socket } from '../services/socket';
import { TrendingUp, Users, Clock, Euro } from 'lucide-react';
import { cn } from '../lib/utils';

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

  const fetchAnalytics = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getAnalytics(date);
      setData(result);
    } catch (e) {
      console.error('Failed to fetch analytics', e);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchAnalytics();
    socket.on('booking-update', fetchAnalytics);
    return () => {
      socket.off('booking-update', fetchAnalytics);
    };
  }, [date, fetchAnalytics]);

  const Card = ({ label, value, sub, loading, icon: Icon, color }: { label: string, value: string | number, sub?: string, loading?: boolean, icon: any, color: string }) => (
    <div className="bg-white rounded-[2rem] p-5 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.05)] border border-slate-100 flex items-center gap-4 transition-all hover:scale-[1.02] hover:shadow-xl group">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm shrink-0", color)}>
            <Icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
        </div>
        <div className="flex flex-col min-w-0">
            {loading ? (
                <div className="animate-pulse space-y-2">
                    <div className="h-5 w-16 bg-slate-100 rounded"></div>
                    <div className="h-3 w-20 bg-slate-50 rounded"></div>
                </div>
            ) : (
                <>
                    <div className="text-xl font-black text-slate-900 tracking-tight">{value}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</div>
                    {sub && <div className="text-[10px] text-emerald-500 font-bold mt-0.5 flex items-center gap-1"><TrendingUp className="w-2.5 h-2.5" /> {sub}</div>}
                </>
            )}
        </div>
    </div>
  );

  return (
    <div className="grid grid-cols-3 gap-4">
       <Card 
            label="Bookings" 
            value={data?.totalBookings ?? 0} 
            sub={data?.growth} 
            loading={loading}
            icon={Users}
            color="bg-indigo-50 text-indigo-600"
        />
       <Card 
            label="Turnover" 
            value={data ? `${data.turnover}€` : '0€'} 
            loading={loading}
            icon={Euro}
            color="bg-emerald-50 text-emerald-600"
        />
       <Card 
            label="Peak Hour" 
            value={data?.peakHour ?? '--:--'} 
            loading={loading}
            icon={Clock}
            color="bg-amber-50 text-amber-600"
        />
    </div>
  );
};
