import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { socket } from '../services/socket';
import { TrendingUp, TrendingDown, Minus, Users, Clock, Euro, Armchair } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from '../i18n/useTranslation';
import type { Analytics as AnalyticsData } from '../types/index';

interface AnalyticsProps {
  date: string;
}

const GrowthSub = ({ growth, growthPct }: { growth?: string; growthPct?: number | null }) => {
  const { t } = useTranslation();
  if (!growth || growth === '—' || growthPct === null || growthPct === undefined) {
    return (
      <span className="text-[10px] text-slate-400 font-bold mt-0.5 flex items-center gap-1">
        <Minus className="w-2.5 h-2.5" /> {t('analytics.noPrior')}
      </span>
    );
  }
  const up = growthPct > 0;
  const flat = growthPct === 0;
  return (
    <span className={cn(
      "text-[10px] font-bold mt-0.5 flex items-center gap-1",
      up ? "text-emerald-500" : flat ? "text-slate-400" : "text-red-500"
    )}>
      {up ? <TrendingUp className="w-2.5 h-2.5" /> : flat ? <Minus className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {growth} {t('analytics.vsYesterday')}
    </span>
  );
};

export const Analytics: React.FC<AnalyticsProps> = ({ date }) => {
  const { t } = useTranslation();
  const [data, setData] = useState<AnalyticsData | null>(null);
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

  const Card = ({ label, value, sub, icon: Icon, color }: {
    label: string;
    value: string | number;
    sub?: React.ReactNode;
    icon: any;
    color: string;
  }) => (
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
                    {sub}
                </>
            )}
        </div>
    </div>
  );

  const maxHourGuests = Math.max(0, ...(data?.hourlyBreakdown.map(h => h.guests) ?? [0]));

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card
            label={t('analytics.bookings')}
            value={data?.totalBookings ?? 0}
            sub={loading ? undefined : <GrowthSub growth={data?.growth} growthPct={data?.growthPct} />}
            icon={Users}
            color="bg-indigo-50 text-indigo-600"
        />
        <Card
            label={t('analytics.turnover').replace('{ticket}', String(data?.avgTicket ?? '–'))}
            value={data ? `${data.turnover.toLocaleString('fr-FR')}€` : '0€'}
            sub={loading || !data ? undefined : (
              <span className="text-[10px] text-slate-400 font-bold mt-0.5">
                {t('analytics.guestsAvg').replace('{g}', String(data.totalGuests)).replace('{a}', String(data.avgPartySize))}
              </span>
            )}
            icon={Euro}
            color="bg-emerald-50 text-emerald-600"
        />
        <Card
            label={t('analytics.peakHour')}
            value={data?.peakHour ?? '—'}
            sub={loading || !data || data.peakHour === '—' ? undefined : (
              <span className="text-[10px] text-slate-400 font-bold mt-0.5">
                {t('analytics.peakArriving').replace('{n}', String(data.peakHourGuests))}
              </span>
            )}
            icon={Clock}
            color="bg-amber-50 text-amber-600"
        />
        <Card
            label={t('analytics.occupancy')}
            value={data ? `${data.occupancyRate}%` : '0%'}
            sub={loading || !data ? undefined : (
              <span className="text-[10px] text-slate-400 font-bold mt-0.5">
                {t('analytics.tablesUsed').replace('{u}', String(data.tablesUsed)).replace('{t}', String(data.totalTables))}
              </span>
            )}
            icon={Armchair}
            color="bg-violet-50 text-violet-600"
        />
      </div>

      {!loading && data && data.hourlyBreakdown.length > 0 && (
        <div className="bg-white rounded-[2rem] px-5 py-4 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.05)] border border-slate-100">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
            {t('analytics.perHour')} <span className="normal-case font-bold text-slate-300">{t('analytics.perHourSub')}</span>
          </div>
          <div className="flex flex-col gap-2">
            {data.hourlyBreakdown.map(h => (
              <div key={h.hour} className="flex items-center gap-3">
                <span className={cn(
                  "text-[11px] font-black w-11 shrink-0 tabular-nums",
                  h.hour === data.peakHour ? "text-amber-600" : "text-slate-500"
                )}>
                  {h.hour}
                </span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", h.hour === data.peakHour ? "bg-amber-400" : "bg-indigo-400")}
                    style={{ width: `${maxHourGuests === 0 ? 0 : (h.guests / maxHourGuests) * 100}%` }}
                  />
                </div>
                <span className="text-[11px] font-bold text-slate-500 w-24 shrink-0 text-right tabular-nums">
                  {t('analytics.resFmt').replace('{b}', String(h.bookings)).replace('{p}', String(h.guestsPct))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
