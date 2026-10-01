import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { socket } from '../services/socket';
import dayjs from '../utils/dayjs';
import {
    UserX, Footprints, Timer, Receipt, Download, GitCompareArrows, TrendingUp,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from '../i18n/useTranslation';
import type { RangeAnalytics as RangeData, RangeDay } from '../types/index';

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

type TrendMetric = 'guests' | 'bookings' | 'turnover';

const TREND_COLORS: Record<TrendMetric, { line: string; soft: string; grad: string }> = {
    guests: { line: '#6366f1', soft: '#a5b4fc', grad: 'trendGuests' },
    bookings: { line: '#8b5cf6', soft: '#c4b5fd', grad: 'trendBookings' },
    turnover: { line: '#10b981', soft: '#6ee7b7', grad: 'trendTurnover' },
};

/** Catmull-Rom → Bézier smoothing through [x, y] points. */
const smoothPath = (pts: [number, number][]): string => {
    if (pts.length === 0) return '';
    if (pts.length < 3) return `M${pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L')}`;
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];
        const c1x = p1[0] + (p2[0] - p0[0]) / 6;
        const c1y = p1[1] + (p2[1] - p0[1]) / 6;
        const c2x = p2[0] - (p3[0] - p1[0]) / 6;
        const c2y = p2[1] - (p3[1] - p1[1]) / 6;
        d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
};

const niceCeil = (v: number): number => {
    if (v <= 0) return 1;
    const exp = Math.floor(Math.log10(v));
    const f = v / Math.pow(10, exp);
    const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return nf * Math.pow(10, exp);
};

/**
 * Trend card: smoothed multi-metric curve with gradient area, labelled axes,
 * average line, min/max annotations and a rich mouse + touch tooltip.
 * N-1 (when shown) aligns by index, dashed.
 */
const TrendCard = ({ days, prev, showPrev }: { days: RangeDay[]; prev: RangeDay[]; showPrev: boolean }) => {
    const { t, lang } = useTranslation();
    const [metric, setMetric] = useState<TrendMetric>('guests');
    const [hover, setHover] = useState<number | null>(null);
    const [mounted, setMounted] = useState(false);
    const svgRef = React.useRef<SVGSVGElement>(null);
    useEffect(() => {
        const id = window.requestAnimationFrame(() => setMounted(true));
        return () => window.cancelAnimationFrame(id);
    }, [metric, days.length]);

    const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
    const colors = TREND_COLORS[metric];
    const W = 640;
    const H = 196;
    const L = 38;
    const R = 12;
    const T = 16;
    const B = 24;
    const plotW = W - L - R;
    const plotH = H - T - B;

    const vals = useMemo(() => days.map(d => d[metric]), [days, metric]);
    const prevVals = useMemo(() => prev.map(d => d[metric]), [prev, metric]);
    const max = Math.max(1, ...vals, ...(showPrev ? prevVals : [0]));
    const yMax = niceCeil(max * 1.12);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(yMax * f * 10) / 10);

    const n = vals.length;
    const x = (i: number) => (n === 1 ? L + plotW / 2 : L + (i / (n - 1)) * plotW);
    const y = (v: number) => T + plotH - (v / yMax) * plotH;

    const pts: [number, number][] = vals.map((v, i) => [x(i), y(v)]);
    const prevPts: [number, number][] = prevVals.map((v, i) => [
        prevVals.length === 1 ? L + plotW / 2 : L + (i / (Math.max(1, prevVals.length - 1))) * plotW,
        y(v),
    ]);
    const line = smoothPath(pts);
    const prevLine = showPrev ? smoothPath(prevPts) : '';
    const area = line ? `${line} L${x(n - 1).toFixed(1)},${(T + plotH).toFixed(1)} L${x(0).toFixed(1)},${(T + plotH).toFixed(1)} Z` : '';

    const avg = n === 0 ? 0 : vals.reduce((s, v) => s + v, 0) / n;
    const maxIdx = vals.indexOf(Math.max(...vals));
    const minIdx = vals.indexOf(Math.min(...vals));

    const xLabels = useMemo(() => {
        if (n === 0) return [];
        if (n <= 8) return days.map((d, i) => ({ i, label: dayjs(d.date).format('DD/MM') }));
        if (n <= 40) {
            const out: { i: number; label: string }[] = [];
            for (let k = 0; k < 6; k++) {
                const i = Math.round((k / 5) * (n - 1));
                out.push({ i, label: dayjs(days[i].date).format('DD/MM') });
            }
            return out;
        }
        const out: { i: number; label: string }[] = [];
        let lastMonth = '';
        days.forEach((d, i) => {
            const m = dayjs(d.date).format('YYYY-MM');
            if (m !== lastMonth) {
                lastMonth = m;
                out.push({ i, label: dayjs(d.date).format("MMM ''YY") });
            }
        });
        return out;
    }, [days, n]);

    const fmtVal = (v: number) =>
        metric === 'turnover' ? `${Math.round(v).toLocaleString(locale)}€` : String(Math.round(v));

    const pointFromClientX = (clientX: number): number | null => {
        const el = svgRef.current;
        if (!el || n === 0) return null;
        const rect = el.getBoundingClientRect();
        const svgX = ((clientX - rect.left) / rect.width) * W;
        let best = 0;
        let bestDist = Infinity;
        for (let i = 0; i < n; i++) {
            const d = Math.abs(x(i) - svgX);
            if (d < bestDist) {
                bestDist = d;
                best = i;
            }
        }
        return best;
    };

    const hoverDay = hover !== null ? days[hover] : null;
    const hoverPrev = hover !== null && showPrev && prev[hover] ? prev[hover][metric] : null;
    const delta = hoverPrev !== null && hoverDay && hoverPrev > 0
        ? Math.round(((hoverDay[metric] - hoverPrev) / hoverPrev) * 100)
        : null;

    const peak = n > 0 ? Math.max(...vals) : 0;
    const summary = n === 0
        ? t('range.empty')
        : t('range.summary')
            .replace('{avg}', fmtVal(avg))
            .replace('{peak}', fmtVal(peak))
            .replace('{peakDate}', dayjs(days[maxIdx].date).format('DD/MM'));

    const metrics: { id: TrendMetric; label: string }[] = [
        { id: 'guests', label: t('range.mGuests') },
        { id: 'bookings', label: t('range.mBookings') },
        { id: 'turnover', label: t('range.mTurnover') },
    ];

    return (
        <div className="bg-white rounded-[2rem] px-5 py-4 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.05)] border border-slate-100">
            <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-auto">
                    {t('range.curve')}
                </span>
                <div className="flex gap-1 bg-slate-100 rounded-xl p-1" role="tablist" aria-label={t('range.curve')}>
                    {metrics.map(m => (
                        <button
                            key={m.id}
                            role="tab"
                            aria-selected={metric === m.id}
                            onClick={() => {
                                setMetric(m.id);
                                setHover(null);
                            }}
                            className={cn(
                                "h-7 px-3 rounded-lg text-[11px] font-black transition-all cursor-pointer",
                                metric === m.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600",
                            )}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>
                {showPrev && (
                    <span className="normal-case text-[10px] font-bold text-slate-300 flex items-center gap-2">
                        <span className="inline-block w-4 h-[3px] rounded" style={{ background: colors.line }} /> N
                        <span className="inline-block w-4 border-t-2 border-dashed border-slate-300" /> N-1
                    </span>
                )}
            </div>

            {n === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center gap-1 text-slate-300">
                    <TrendingUp className="w-6 h-6" />
                    <p className="text-xs font-bold">{t('range.empty')}</p>
                </div>
            ) : (
                <div className="relative">
                    <svg
                        ref={svgRef}
                        viewBox={`0 0 ${W} ${H}`}
                        className={cn("w-full h-48 transition-opacity duration-500", mounted ? "opacity-100" : "opacity-0")}
                        role="img"
                        aria-label={summary}
                        onMouseMove={e => setHover(pointFromClientX(e.clientX))}
                        onMouseLeave={() => setHover(null)}
                        onTouchStart={e => setHover(pointFromClientX(e.touches[0].clientX))}
                        onTouchMove={e => setHover(pointFromClientX(e.touches[0].clientX))}
                        onTouchEnd={() => setHover(null)}
                    >
                        <defs>
                            <linearGradient id={colors.grad} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={colors.line} stopOpacity={0.28} />
                                <stop offset="100%" stopColor={colors.line} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        {ticks.map(v => (
                            <g key={v}>
                                <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="stroke-slate-100" strokeWidth={1} strokeDasharray={v === 0 ? undefined : '3 4'} />
                                <text x={L - 6} y={y(v) + 3.5} textAnchor="end" className="fill-slate-400" fontSize={9} fontWeight={800}>
                                    {metric === 'turnover' && v >= 1000 ? `${Math.round(v / 1000)}k` : v}
                                </text>
                            </g>
                        ))}
                        {xLabels.map(({ i, label }) => (
                            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-slate-400" fontSize={9} fontWeight={800}>
                                {label}
                            </text>
                        ))}
                        {avg > 0 && (
                            <g>
                                <line x1={L} x2={W - R} y1={y(avg)} y2={y(avg)} stroke={colors.line} strokeWidth={1.2} strokeDasharray="6 4" opacity={0.45} />
                                <text x={W - R} y={y(avg) - 4} textAnchor="end" fontSize={9} fontWeight={800} fill={colors.line} opacity={0.8}>
                                    {t('range.avgFmt').replace('{v}', fmtVal(avg))}
                                </text>
                            </g>
                        )}
                        {area && <path d={area} fill={`url(#${colors.grad}`} />}
                        {prevLine && (
                            <path d={prevLine} fill="none" className="stroke-slate-300" strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" />
                        )}
                        {line && (
                            <path d={line} fill="none" stroke={colors.line} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
                        )}
                        {n > 1 && peak !== vals[minIdx] && (
                            <g>
                                <circle cx={x(maxIdx)} cy={y(vals[maxIdx])} r={4} fill={colors.line} stroke="#fff" strokeWidth={2} />
                                <text x={x(maxIdx)} y={y(vals[maxIdx]) - 9} textAnchor="middle" fontSize={10} fontWeight={900} fill={colors.line}>
                                    {fmtVal(vals[maxIdx])}
                                </text>
                            </g>
                        )}
                        {line && (
                            <circle cx={x(n - 1)} cy={y(vals[n - 1])} r={4.5} fill={colors.line} stroke="#fff" strokeWidth={2.5}>
                                <animate attributeName="r" values="4.5;6;4.5" dur="2s" repeatCount="indefinite" />
                            </circle>
                        )}
                        {hover !== null && hoverDay && (
                            <g pointerEvents="none">
                                <line x1={x(hover)} x2={x(hover)} y1={T - 4} y2={T + plotH} className="stroke-slate-300" strokeWidth={1} />
                                <circle cx={x(hover)} cy={y(vals[hover])} r={5} fill={colors.line} stroke="#fff" strokeWidth={2.5} />
                                {hoverPrev !== null && (
                                    <circle cx={x(hover)} cy={y(hoverPrev)} r={4} fill="#fff" className="stroke-slate-300" strokeWidth={2} />
                                )}
                            </g>
                        )}
                        <rect
                            x={L} y={T - 6} width={plotW} height={plotH + 12} fill="transparent"
                            onMouseMove={e => setHover(pointFromClientX(e.clientX))}
                            onMouseLeave={() => setHover(null)}
                        />
                    </svg>

                    {hover !== null && hoverDay && (
                        <div
                            className="absolute top-0 z-10 bg-slate-900 text-white rounded-2xl px-3.5 py-2.5 shadow-xl pointer-events-none min-w-[132px]"
                            style={hover > n * 0.65 ? { right: 0 } : { left: `${(x(hover) / W) * 100}%` }}
                        >
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {dayjs(hoverDay.date).format('ddd D MMM')}
                            </p>
                            <p className="text-lg font-black tabular-nums leading-tight" style={{ color: colors.soft }}>
                                {fmtVal(hoverDay[metric])}
                            </p>
                            {hoverPrev !== null && delta !== null && (
                                <p className={cn(
                                    "text-[11px] font-black tabular-nums",
                                    delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-slate-400",
                                )}>
                                    {delta > 0 ? '▲' : delta < 0 ? '▼' : '＝'} {Math.abs(delta)}% {t('range.vsPrev')}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
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

            {loading || !data ? (
                <div className="bg-white rounded-[2rem] px-5 py-4 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.05)] border border-slate-100">
                    <div className="h-48 bg-slate-50 rounded-2xl animate-pulse" />
                </div>
            ) : (
                <TrendCard days={data.days} prev={prev?.days ?? []} showPrev={compare} />
            )}

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
