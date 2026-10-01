import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

import { prisma } from '../lib/prisma';
import { getSettings, ticketForService, RESTAURANT_TZ } from './settingsService';

dayjs.extend(utc);
dayjs.extend(timezone);

export const MAX_RANGE_DAYS = 366;
/** Staff-entered bookings are walk-ins; public form enforces 2h advance. */
export const WALKIN_HEURISTIC_MINUTES = 120;

export interface DayPoint {
    date: string;
    bookings: number;
    guests: number;
    turnover: number;
    noShows: number;
    cancellations: number;
    walkins: number;
}

export interface HeatCell {
    /** dayjs .day(): 0 = Sunday … 6 = Saturday. */
    dow: number;
    hour: string;
    bookings: number;
    guests: number;
}

export interface SizeBand {
    label: '2' | '4' | '6+';
    bookings: number;
    guests: number;
}

export interface TopClient {
    name: string;
    visits: number;
    noShows: number;
    lastVisit: string;
}

export interface RangeTotals {
    bookings: number;
    guests: number;
    turnover: number;
    noShows: number;
    cancellations: number;
    noShowRate: number;
    cancelRate: number;
    walkins: number;
    walkinShare: number;
    /** True when any walk-in came from the <2h heuristic (pre-source history). */
    estimatedWalkins: boolean;
}

export interface TurnoverStats {
    /** Mean minutes per seated party; 0 when nothing seated. */
    avgMinutes: number;
    /** Share (0-100) of the average built on real leftAt−seatedAt pairs. */
    realShare: number;
}

export interface CrmStats {
    newClients: number;
    returningClients: number;
    top: TopClient[];
}

export interface RangeAnalytics {
    from: string;
    to: string;
    days: DayPoint[];
    totals: RangeTotals;
    turnover: TurnoverStats;
    sizeBands: SizeBand[];
    heatmap: HeatCell[];
    crm: CrmStats;
    avgTicketLunch: number | null;
    avgTicketDinner: number | null;
}

type RangeRow = {
    size: number;
    startTime: Date;
    endTime: Date;
    createdAt: Date;
    status: string;
    cancelledBy?: string | null;
    source?: string | null;
    name: string;
    phone?: string | null;
    email?: string | null;
    seatedAt?: Date | null;
    leftAt?: Date | null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Stable guest identity: phone digits, else email, else normalized name. */
export function guestKey(r: Pick<RangeRow, 'name' | 'phone' | 'email'>): string {
    const digits = (r.phone ?? '').replace(/\D/g, '');
    if (digits.length >= 6) return `p:${digits}`;
    const email = (r.email ?? '').trim().toLowerCase();
    if (email) return `e:${email}`;
    return `n:${r.name.trim().toLowerCase()}`;
}

const isNoShow = (r: RangeRow) => r.status === 'CANCELLED' && r.cancelledBy === 'AUTO';
const isCancelled = (r: RangeRow) => r.status === 'CANCELLED';

export function isWalkin(r: RangeRow): { walkin: boolean; estimated: boolean } {
    if (r.source === 'WALKIN') return { walkin: true, estimated: false };
    const leadMinutes = dayjs(r.startTime).diff(dayjs(r.createdAt), 'minute');
    if (leadMinutes < WALKIN_HEURISTIC_MINUTES) return { walkin: true, estimated: true };
    return { walkin: false, estimated: false };
}

/**
 * Pure aggregation over already-fetched rows.
 * `priorKeys` = guest identities with a booking starting before `from`
 * (drives new vs returning). Unit-testable without Prisma.
 */
export function computeRangeAnalytics(
    from: string,
    to: string,
    rows: RangeRow[],
    priorKeys: Set<string>,
    avgTicket: number,
    avgTicketLunch: number | null,
    avgTicketDinner: number | null,
): RangeAnalytics {
    const dayMap = new Map<string, DayPoint>();
    const heat = new Map<string, HeatCell>();
    const bands: Record<SizeBand['label'], SizeBand> = {
        '2': { label: '2', bookings: 0, guests: 0 },
        '4': { label: '4', bookings: 0, guests: 0 },
        '6+': { label: '6+', bookings: 0, guests: 0 },
    };
    const clients = new Map<string, { name: string; visits: number; noShows: number; lastVisit: Date }>();
    let realMinutes = 0;
    let realCount = 0;
    let plannedMinutes = 0;
    let plannedCount = 0;
    let walkins = 0;
    let estimatedWalkins = false;
    let noShows = 0;
    let cancellations = 0;
    let bookings = 0;
    let guests = 0;
    let turnover = 0;

    const dayOf = (r: RangeRow) => {
        const key = dayjs(r.startTime).tz(RESTAURANT_TZ).format('YYYY-MM-DD');
        let d = dayMap.get(key);
        if (!d) {
            d = { date: key, bookings: 0, guests: 0, turnover: 0, noShows: 0, cancellations: 0, walkins: 0 };
            dayMap.set(key, d);
        }
        return d;
    };

    for (const r of rows) {
        const d = dayOf(r);
        const noshow = isNoShow(r);
        const cancelled = isCancelled(r);
        if (noshow) {
            noShows += 1;
            d.noShows += 1;
        }
        if (cancelled) {
            cancellations += 1;
            d.cancellations += 1;
        } else {
            bookings += 1;
            guests += r.size;
            d.bookings += 1;
            d.guests += r.size;
            const ticket = ticketForService(r.startTime, avgTicket, avgTicketLunch, avgTicketDinner);
            const t = r.size * ticket;
            turnover += t;
            d.turnover += t;

            const w = isWalkin(r);
            if (w.walkin) {
                walkins += 1;
                d.walkins += 1;
                if (w.estimated) estimatedWalkins = true;
            }

            const band = r.size <= 2 ? bands['2'] : r.size <= 4 ? bands['4'] : bands['6+'];
            band.bookings += 1;
            band.guests += r.size;

            const start = dayjs(r.startTime).tz(RESTAURANT_TZ);
            const hk = `${start.day()}|${start.format('HH')}:00`;
            const cell = heat.get(hk) ?? { dow: start.day(), hour: `${start.format('HH')}:00`, bookings: 0, guests: 0 };
            cell.bookings += 1;
            cell.guests += r.size;
            heat.set(hk, cell);

            if (r.seatedAt) {
                const planned = dayjs(r.endTime).diff(dayjs(r.seatedAt), 'minute');
                if (r.leftAt) {
                    const real = dayjs(r.leftAt).diff(dayjs(r.seatedAt), 'minute');
                    if (real > 0 && real < 12 * 60) {
                        realMinutes += real;
                        realCount += 1;
                    } else if (planned > 0 && planned < 12 * 60) {
                        plannedMinutes += planned;
                        plannedCount += 1;
                    }
                } else if (planned > 0 && planned < 12 * 60) {
                    plannedMinutes += planned;
                    plannedCount += 1;
                }
            }

            const key = guestKey(r);
            const c = clients.get(key) ?? { name: r.name, visits: 0, noShows: 0, lastVisit: r.startTime };
            c.visits += 1;
            if (r.startTime > c.lastVisit) {
                c.lastVisit = r.startTime;
                c.name = r.name;
            }
            clients.set(key, c);
        }
        if (noshow) {
            const key = guestKey(r);
            const c = clients.get(key) ?? { name: r.name, visits: 0, noShows: 0, lastVisit: r.startTime };
            c.noShows += 1;
            clients.set(key, c);
        }
    }

    const totalPairs = realCount + plannedCount;
    const avgMinutes = totalPairs === 0 ? 0 : Math.round((realMinutes + plannedMinutes) / totalPairs);
    const realShare = totalPairs === 0 ? 0 : round1((realCount / totalPairs) * 100);

    const seen = new Set<string>();
    let newClients = 0;
    let returningClients = 0;
    for (const key of clients.keys()) {
        if (seen.has(key)) continue;
        seen.add(key);
        if (priorKeys.has(key)) returningClients += 1;
        else newClients += 1;
    }

    const top: TopClient[] = [...clients.entries()]
        .sort((a, b) => b[1].visits - a[1].visits || b[1].lastVisit.getTime() - a[1].lastVisit.getTime())
        .slice(0, 8)
        .map(([_, c]) => ({
            name: c.name,
            visits: c.visits,
            noShows: c.noShows,
            lastVisit: dayjs(c.lastVisit).tz(RESTAURANT_TZ).format('YYYY-MM-DD'),
        }));

    const closedBase = bookings + cancellations;
    return {
        from,
        to,
        days: [...dayMap.values()].sort((a, b) => (a.date < b.date ? -1 : 1)),
        totals: {
            bookings,
            guests,
            turnover: Math.round(turnover),
            noShows,
            cancellations,
            noShowRate: closedBase === 0 ? 0 : round1((noShows / closedBase) * 100),
            cancelRate: closedBase === 0 ? 0 : round1((cancellations / closedBase) * 100),
            walkins,
            walkinShare: bookings === 0 ? 0 : round1((walkins / bookings) * 100),
            estimatedWalkins,
        },
        turnover: { avgMinutes, realShare },
        sizeBands: [bands['2'], bands['4'], bands['6+']],
        heatmap: [...heat.values()].sort((a, b) => a.dow - b.dow || (a.hour < b.hour ? -1 : 1)),
        crm: { newClients, returningClients, top },
        avgTicketLunch,
        avgTicketDinner,
    };
}

/**
 * Exact range analytics from the database: bounded window, minimal selects,
 * single pass in memory. Prior-visit lookup is restricted to identities
 * actually seen in the window (one OR query, capped).
 */
export async function getRangeAnalytics(fromStr: string, toStr: string, tenantId: string): Promise<RangeAnalytics> {
    const from = dayjs.tz(fromStr, 'YYYY-MM-DD', RESTAURANT_TZ);
    const to = dayjs.tz(toStr, 'YYYY-MM-DD', RESTAURANT_TZ);
    if (!from.isValid() || !to.isValid() || to.isBefore(from)) {
        throw new Error('Invalid range, expected YYYY-MM-DD from<=to');
    }
    if (to.diff(from, 'day') + 1 > MAX_RANGE_DAYS) {
        throw new Error(`Range too wide, max ${MAX_RANGE_DAYS} days`);
    }
    const start = from.startOf('day').toDate();
    const end = to.endOf('day').toDate();

    const [rows, settings] = await Promise.all([
        prisma.booking.findMany({
            where: { tenantId, startTime: { gte: start, lte: end } },
            select: {
                size: true,
                startTime: true,
                endTime: true,
                createdAt: true,
                status: true,
                cancelledBy: true,
                source: true,
                name: true,
                phone: true,
                email: true,
                seatedAt: true,
                leftAt: true,
            },
        }),
        getSettings(tenantId),
    ]);

    const typed = rows as unknown as RangeRow[];
    const phones = new Set<string>();
    const emails = new Set<string>();
    const names = new Set<string>();
    for (const r of typed) {
        const digits = (r.phone ?? '').replace(/\D/g, '');
        if (digits.length >= 6) phones.add(digits);
        else if ((r.email ?? '').trim()) emails.add(r.email!.trim().toLowerCase());
        else names.add(r.name.trim().toLowerCase());
    }
    const or: object[] = [];
    if (phones.size > 0) {
        // Phone match needs digit-normalization; compare in memory instead.
        or.push({ phone: { not: null } });
    }
    if (emails.size > 0) or.push({ email: { in: [...emails].slice(0, 2000) } });
    if (names.size > 0) or.push({ name: { in: [...names].slice(0, 2000), mode: 'insensitive' as const } });

    const priorKeys = new Set<string>();
    if (or.length > 0) {
        const prior = await prisma.booking.findMany({
            where: { tenantId, startTime: { lt: start }, OR: or as never },
            select: { name: true, phone: true, email: true, startTime: true },
            take: 20000,
        });
        for (const p of prior) priorKeys.add(guestKey(p as unknown as RangeRow));
    }

    return computeRangeAnalytics(
        fromStr,
        toStr,
        typed,
        priorKeys,
        settings.avgTicket,
        settings.avgTicketLunch,
        settings.avgTicketDinner,
    );
}
