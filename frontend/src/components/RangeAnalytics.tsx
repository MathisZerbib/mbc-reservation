import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { socket } from '../services/socket';
import dayjs from '../utils/dayjs';
import {
    UserX, Footprints, Timer, Receipt, Download, GitCompareArrows,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from '../i18n/useTranslation';
import type { RangeAnalytics as RangeData } from '../types/index';

interface RangeProps {
    from: string;
    to: string;
}

const shiftYear = (d: string) => dayjs(d).subtract(1, 'year').format('YYYY-MM-DD');

const fmtDur = (min: number) => {
    if (min <= 0) return '—';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
};

/** Covers curve (SVG polyline). N-1 aligned by index, dashed. */
const Curves = ({ days, prev, showPrev }: { days: { guests: number }[]; prev: { guests: number }[]; showPrev: boolean }) => {
    const W = 600;
    const H = 170;
    const P = 12;
    const max = Math.max(1, ...days.map(d => d.guests), ...(showPrev ? prev.map(d => d.guests) : [0]));
    const pts = (arr: { guests: number }[]) =>
        arr.map((d, i) => {
            const x = arr.length === 1 ? W / 2 : P + (i / (arr.length - 1)) * (W - 2 * P);
            const y = H - P - (d.guests / max) * (H - 2 * P);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');
    const area = days.length > 0
        ? `${P},${H - P} ${pts(days)} ${days.length === 1 ? W / 2 : W - P},${H - P}`
        : '';
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40" role="img">
            {[0.25, 0.5, 0.75].map(f => (
                <line key={f} x1={P} x2={W - P} y1={H * f} y2={H * f} stroke="currentColor" className="text-slate-100" strokeWidth={1} />
            ))}
            {area && <polygon points={area} className="fill-indigo-500/10" />}
            {showPrev && prev.length > 0 && (
                <polyline points={pts(prev)} fill="none" className="stroke-slate-300" strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" />
            )}
            {days.length > 0 && (
                <polyline points={pts(days)} fill="none" className="stroke-indigo-500" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            )}
        </svg>
    );
};

/** Donut: new vs returning clients. */
const Donut = ({ a, b }: { a: number; b: number }) => {
    const total = a + b;
    const R = 34;
    const C = 2 * Math.PI * R;
    const aFrac = total === 0 ? 0 : a / total;
    return (
        <svg viewBox="0 0 84 84" className="w-20 h-20 shrink-0" role="img">
            <circle cx="42" cy="42" r={R} fill="none" className="stroke-slate-100" strokeWidth="11" />
            {total > 0 && (
                <>
                    <circle cx="42" cy="42" r={R} fill="none" className="stroke-indigo-500" strokeWidth="11"
                        strokeDasharray={`${(aFrac * C).toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 42 42)" strokeLinecap="round" />
                    <circle cx="42" cy="42" r={R} fill="none" className="stroke-emerald-400" strokeWidth="11"
                        strokeDasharray={`${((1 - aFrac) * C).toFixed(1)} ${C.toFixed(1)}`}
                        strokeDashoffset={-(aFrac * C).toFixed(1)} transform="rotate(-90 42 42)" strokeLinecap="round" />
                </>
            )}
        </svg>
    );
};

const toCsv = (d: RangeData): string => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [
        'date,bookings,guests,turnover_eur,no_shows,cancellations,walkins',
        ...d.days.map(x => [x.date, x.bookings, x.guests, x.turnover, x.noShows, x.cancellations, x.walkins].map(esc).join(',')),
        '',
        `TOTAL,${d.totals.bookings},${d.totals.guests},${d.totals.turnover},${d.totals.noShows},${d.totals.cancellations},${d.totals.walkins}`,
        `NO_SHOW_RATE_PCT,${d.totals.noShowRate}`,
        `WALKIN_SHARE_PCT,${d.totals.walkinShare}`,
        `AVG_TURNOVER_MIN,${d.turnover.avgMinutes}`,
    ];
    return lines.join('\n');
};

export const RangeAnalytics: React.FC<RangeProps> = ({ from, to }) => {
    const { t, lang } = useTranslation();
    const [data, setData] = useState<RangeData | null>(null);
    const [prev, setPrev] = useState<RangeData | null>(null);
    const [loading, setLoading] = useState(true);
    const [compare, setCompare] = useState(false);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [cur, old] = await Promise.all([
                api.getRangeAnalytics(from, to),
                compare ? api.getRangeAnalytics(shiftYear(from), shiftYear(to)) : Promise.resolve(null),
            ]);
            setData(cur);
            setPrev(old);
        } catch (e) {
            console.error('Failed to fetch range analytics', e);
        } finally {
            setLoading(false);
        }
    }, [from, to, compare]);

    useEffect(() => {
        fetchAll();
        socket.on('booking-update', fetchAll);
        return () => {
            socket.off('booking-update', fetchAll);
        };
    }, [fetchAll]);

    const blended = useMemo(() => {
        if (!data || data.totals.guests === 0) return 0;
        return Math.round((data.totals.turnover / data.totals.guests) * 100) / 100;
    }, [data]);

    const hours = useMemo(
        () => [...new Set((data?.heatmap ?? []).map(h => h.hour))].sort(),
        [data],
    );
    const cell = (dow: number, hour: string) => data?.heatmap.find(h => h.dow === dow && h.hour === hour);
    const maxHeat = Math.max(1, ...(data?.heatmap.map(h => h.guests) ?? [0]));
    const maxBand = Math.max(1, ...(data?.sizeBands.map(b => b.bookings) ?? [0]));
    // Monday-first row order (dayjs .day(): 0 = Sunday).
    const dowRows = [1, 2, 3, 4, 5, 6, 0];
    const dowLabel = (dow: number) => dayjs().day(dow).format('dd');

    const exportCsv = () => {
        if (!data) return;
        const blob = new Blob([toCsv(data)], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stats-${from}-${to}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const Card = ({ label, value, sub, icon: Icon, color }: {
        label: string; value: string; sub?: React.ReactNode; icon: LucideIcon; color: string;
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
                        <div className="text-xl font-black text-slate-900 tracking-tight tabular-nums">{value}</div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</div>
                        {sub}
                    </>
                )}
            </div>
        </div>
    );

    const crmTotal = (data?.crm.newClients ?? 0) + (data?.crm.returningClients ?? 0);

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setCompare(v => !v)}
                    className={cn(
                        "h-10 px-4 rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer border",
                        compare
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                            : "bg-white border-slate-200 text-slate-500 hover:border-indigo-200",
                    )}
                >
                    <GitCompareArrows className="w-4 h-4" /> {t('range.compare')}
                </button>
                <button
                    onClick={exportCsv}
                    disabled={!data}
                    className="h-10 px-4 rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer bg-white border border-slate-200 text-slate-500 hover:border-emerald-200 hover:text-emerald-600 disabled:opacity-50"
                >
                    <Download className="w-4 h-4" /> CSV
                </button>
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <Card
                    label={t('range.noShow')}
                    value={data ? `${data.totals.noShowRate}%` : '—'}
                    sub={!loading && data ? (
                        <span className="text-[10px] text-slate-400 font-bold mt-0.5">
                            {t('range.noShowSub').replace('{n}', String(data.totals.noShows)).replace('{c}', String(data.totals.cancellations))}
                        </span>
                    ) : undefined}
                    icon={UserX}
                    color="bg-red-50 text-red-600"
                />
                <Card
                    label={t('range.walkin')}
                    value={data ? `${data.totals.walkinShare}%` : '—'}
                    sub={!loading && data ? (
                        <span className="text-[10px] text-slate-400 font-bold mt-0.5">
                            {t('range.walkinSub').replace('{n}', String(data.totals.walkins))}
                            {data.totals.estimatedWalkins ? ` · ${t('range.estimated')}` : ''}
                        </span>
                    ) : undefined}
                    icon={Footprints}
                    color="bg-blue-50 text-blue-600"
                />
                <Card
                    label={t('range.turnoverTime')}
                    value={data ? fmtDur(data.turnover.avgMinutes) : '—'}
                    sub={!loading && data ? (
                        <span className="text-[10px] text-slate-400 font-bold mt-0.5">
                            {data.turnover.realShare >= 50
                                ? t('range.realShare').replace('{p}', String(data.turnover.realShare))
                                : t('range.estimated')}
                        </span>
                    ) : undefined}
                    icon={Timer}
                    color="bg-amber-50 text-amber-600"
                />
                <Card
                    label={t('range.ticket')}
                    value={data ? `${blended.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}€` : '—'}
                    sub={!loading && data ? (
                        <span className="text-[10px] text-slate-400 font-bold mt-0.5">
                            {(data.avgTicketLunch != null || data.avgTicketDinner != null)
                                ? t('range.ticketSub').replace('{l}', String(data.avgTicketLunch ?? '–')).replace('{d}', String(data.avgTicketDinner ?? '–'))
                                : t('range.ticketGlobal')}
                        </span>
                    ) : undefined}
                    icon={Receipt}
                    color="bg-emerald-50 text-emerald-600"
                />
            </div>

            <div className="bg-white rounded-[2rem] px-5 py-4 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.05)] border border-slate-100">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-3">
                    {t('range.curve')}
                    {compare && (
                        <span className="normal-case font-bold text-slate-300 flex items-center gap-2">
                            <span className="inline-block w-4 h-0.5 bg-indigo-500 rounded" /> N
                            <span className="inline-block w-4 border-t-2 border-dashed border-slate-300" /> N-1
                        </span>
                    )}
                </div>
                {loading || !data ? (
                    <div className="h-40 bg-slate-50 rounded-2xl animate-pulse" />
                ) : (
                    <Curves days={data.days} prev={prev?.days ?? []} showPrev={compare} />
                )}
            </div>

            {hours.length > 0 && (
                <div className="bg-white rounded-[2rem] px-5 py-4 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.05)] border border-slate-100 overflow-x-auto">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{t('range.heatmap')}</div>
                    <div className="min-w-[520px]">
                        <div className="grid gap-1" style={{ gridTemplateColumns: `2.2rem repeat(${hours.length}, 1fr)` }}>
                            <span />
                            {hours.map(h => (
                                <span key={h} className="text-[9px] font-black text-slate-400 text-center tabular-nums">{h.slice(0, 2)}h</span>
                            ))}
                            {dowRows.map(dow => (
                                <React.Fragment key={dow}>
                                    <span className="text-[9px] font-black text-slate-400 uppercase self-center">{dowLabel(dow)}</span>
                                    {hours.map(h => {
                                        const c = cell(dow, h);
                                        const v = c?.guests ?? 0;
                                        return (
                                            <div
                                                key={h}
                                                title={`${dowLabel(dow)} ${h} · ${v} ${t('range.coversWord')}`}
                                                className={cn(
                                                    "h-7 rounded-md flex items-center justify-center text-[9px] font-black tabular-nums transition-transform hover:scale-105",
                                                    v === 0 ? "bg-slate-50 text-slate-300" : "bg-indigo-600 text-white",
                                                )}
                                                style={v === 0 ? undefined : { opacity: 0.15 + 0.85 * (v / maxHeat) }}
                                            >
                                                {v > 0 ? v : ''}
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="grid md:grid-cols-2 gap-3">
                <div className="bg-white rounded-[2rem] px-5 py-4 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.05)] border border-slate-100">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{t('range.sizes')}</div>
                    <div className="flex flex-col gap-2.5">
                        {(data?.sizeBands ?? []).map(b => (
                            <div key={b.label} className="flex items-center gap-3">
                                <span className="text-[11px] font-black w-8 shrink-0 text-slate-500 tabular-nums">
                                    {b.label === '6+' ? '6+' : `≤${b.label}`}
                                </span>
                                <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                                    <div className="h-full rounded-full bg-violet-400 transition-all" style={{ width: `${(b.bookings / maxBand) * 100}%` }} />
                                </div>
                                <span className="text-[11px] font-bold text-slate-500 w-20 shrink-0 text-right tabular-nums">
                                    {t('range.tablesFmt').replace('{n}', String(b.bookings))}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-[2rem] px-5 py-4 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.05)] border border-slate-100">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{t('range.crm')}</div>
                    {loading || !data ? (
                        <div className="h-20 bg-slate-50 rounded-2xl animate-pulse" />
                    ) : (
                        <div className="flex items-center gap-4">
                            <Donut a={data.crm.newClients} b={data.crm.returningClients} />
                            <div className="flex flex-col gap-1.5 text-xs font-bold text-slate-600">
                                <span className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                                    {t('range.newClients').replace('{n}', String(data.crm.newClients))}
                                </span>
                                <span className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                                    {t('range.returning').replace('{n}', String(data.crm.returningClients))}
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold">
                                    {crmTotal === 0 ? '—' : `${Math.round((data.crm.returningClients / crmTotal) * 100)}% ${t('range.retention')}`}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {(data?.crm.top.length ?? 0) > 0 && (
                <div className="bg-white rounded-[2rem] px-5 py-4 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.05)] border border-slate-100 overflow-x-auto">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('range.top')}</div>
                    <table className="w-full text-sm min-w-[420px]">
                        <tbody>
                            {data!.crm.top.map(c => (
                                <tr key={c.name} className="border-t border-slate-50 first:border-0">
                                    <td className="py-2 pr-2 font-black text-slate-900 truncate max-w-[160px]">{c.name}</td>
                                    <td className="py-2 px-2 text-right font-bold text-slate-500 tabular-nums whitespace-nowrap">
                                        {t('range.visitsFmt').replace('{n}', String(c.visits))}
                                    </td>
                                    <td className={cn(
                                        "py-2 px-2 text-right font-bold tabular-nums whitespace-nowrap",
                                        c.noShows > 0 ? "text-red-500" : "text-slate-300",
                                    )}>
                                        {c.noShows > 0 ? t('range.noShowsFmt').replace('{n}', String(c.noShows)) : '—'}
                                    </td>
                                    <td className="py-2 pl-2 text-right text-[11px] font-bold text-slate-400 tabular-nums whitespace-nowrap">
                                        {dayjs(c.lastVisit).format('DD/MM')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
