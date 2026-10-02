import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { parseDepositAmount } from './depositService';

dayjs.extend(utc);
dayjs.extend(timezone);

export const RESTAURANT_TZ = 'Europe/Paris';

export const MIN_AVG_TICKET = 1;
export const MAX_AVG_TICKET = 1000;

export const MIN_LATE_GRACE_MINUTES = 0;
export const MAX_LATE_GRACE_MINUTES = 120;

export const MIN_DEPOSIT_SIZE = 2;
export const MAX_DEPOSIT_SIZE = 100;

export const MIN_TURNOVER_MINUTES = 30;
export const MAX_TURNOVER_MINUTES = 300;

/** Starting value for fresh installs (tenant changes it in Settings). */
export const DEFAULT_AVG_TICKET = 55;

/** Starting late tolerance in minutes (tenant changes it in Settings). */
export const DEFAULT_LATE_GRACE_MINUTES = 15;

/** One bookable service window within a day (HH:mm, 24h). */
export interface OpenRange {
    open: string;
    close: string;
}

/**
 * Weekly opening schedule. Keys are dayjs `.day()` (0=Sunday..6=Saturday);
 * a missing or empty day means closed. Max 2 ranges per day (lunch+dinner).
 * Null (DB default) = legacy behavior: 16:00-22:00 every day.
 */
export type OpenHours = Partial<Record<string, OpenRange[]>>;

/** Grid step for generated booking slots. */
export const SLOT_MINUTES = 30;

/** Legacy fallback when no schedule is set (matches the historic hardcoding). */
export const LEGACY_OPEN = '16:00';
export const LEGACY_CLOSE = '22:00';
export const MAX_RANGES_PER_DAY = 2;

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseRange(input: unknown, path: string): OpenRange {
    if (typeof input !== 'object' || input === null) throw new Error(`${path} must be {open, close}`);
    const { open, close } = input as Record<string, unknown>;
    if (typeof open !== 'string' || !HHMM.test(open)) throw new Error(`${path}.open must be HH:mm`);
    if (typeof close !== 'string' || !HHMM.test(close)) throw new Error(`${path}.close must be HH:mm`);
    if (open >= close) throw new Error(`${path} needs open < close`);
    return { open, close };
}

/**
 * Pure validation for the weekly schedule. Null/undefined clears back to the
 * legacy default; otherwise an object keyed 0-6 with ≤2 valid ranges per day.
 * Throws with a human-readable message (controller maps to 400).
 */
export function parseOpenHours(input: unknown): OpenHours | null {
    if (input === null || input === undefined) return null;
    if (typeof input !== 'object' || Array.isArray(input)) {
        throw new Error('openHours must be an object keyed by weekday 0-6, or null');
    }
    const out: OpenHours = {};
    for (const [day, ranges] of Object.entries(input as Record<string, unknown>)) {
        if (!/^[0-6]$/.test(day)) throw new Error(`openHours key "${day}" must be a weekday 0 (Sun) - 6 (Sat)`);
        if (!Array.isArray(ranges)) throw new Error(`openHours[${day}] must be an array of ranges`);
        if (ranges.length > MAX_RANGES_PER_DAY) {
            throw new Error(`openHours[${day}] allows at most ${MAX_RANGES_PER_DAY} ranges`);
        }
        const parsed = ranges.map((r, i) => parseRange(r, `openHours[${day}][${i}]`));
        if (parsed.length > 0) out[day] = parsed;
    }
    return out;
}

/**
 * Bookable 30-minute slots for a date (YYYY-MM-DD, restaurant timezone).
 * Closed day (or empty schedule entry) → []. Null schedule → legacy 16:00-22:00.
 * Single source of truth for every availability surface (public widget,
 * suggestions, daily grid) and the createBooking guard.
 */
export function resolveOpenSlots(dateStr: string, openHours: OpenHours | null | undefined): string[] {
    const day = dayjs(dateStr, 'YYYY-MM-DD');
    if (!day.isValid()) return [];
    // Null schedule = legacy grid every day; a set schedule with a missing
    // day = closed (never silently fall back to legacy hours).
    if (openHours == null) {
        return gridSlots([{ open: LEGACY_OPEN, close: LEGACY_CLOSE }]);
    }
    const weekday = day.tz(RESTAURANT_TZ).day().toString();
    const ranges = openHours[weekday];
    if (!ranges || ranges.length === 0) return [];
    return gridSlots(ranges);
}

/** 30-minute grid over ranges, inclusive of both ends, deduped + sorted. */
function gridSlots(ranges: OpenRange[]): string[] {
    const toMin = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };
    const slots: string[] = [];
    for (const { open, close } of ranges) {
        for (let m = toMin(open); m <= toMin(close); m += SLOT_MINUTES) {
            const hh = String(Math.floor(m / 60)).padStart(2, '0');
            const mm = String(m % 60).padStart(2, '0');
            slots.push(`${hh}:${mm}`);
        }
    }
    return [...new Set(slots)].sort();
}

export interface RestaurantSettingsDTO {
    avgTicket: number;
    avgTicketLunch: number | null;
    avgTicketDinner: number | null;
    retentionMonths: number;
    floorPlanImageUrl: string | null;
    lateGraceMinutes: number;
    autoCancelLate: boolean;
    depositEnabled: boolean;
    depositMinSize: number;
    depositAmount: number;
    stripeAccountId: string | null;
    stripeOnboarded: boolean;
    /** Weekly opening schedule; null = legacy 16:00-22:00 daily. */
    openHours: OpenHours | null;
    tableTurnoverMinutes: number;
    updatedAt: string;
}

/**
 * Pure validation for settings input. Returns the parsed avgTicket
 * or throws with a human-readable message (controller maps to 400).
 */
export function parseAvgTicket(input: unknown): number {
    const value = typeof input === 'string' ? Number(input) : (input as number);
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error('avgTicket must be a number');
    }
    if (value < MIN_AVG_TICKET || value > MAX_AVG_TICKET) {
        throw new Error(`avgTicket must be between ${MIN_AVG_TICKET} and ${MAX_AVG_TICKET}`);
    }
    return Math.round(value * 100) / 100;
}

/**
 * Optional per-service ticket. Null/undefined clears back to the
 * global avgTicket fallback; otherwise same range rules as avgTicket.
 */
export function parseOptionalAvgTicket(input: unknown, name: string): number | null {
    if (input === null || input === undefined || input === '') return null;
    try {
        return parseAvgTicket(input);
    } catch {
        throw new Error(`${name} must be between ${MIN_AVG_TICKET} and ${MAX_AVG_TICKET}`);
    }
}
/**
 * Pure validation for the late-tolerance input. Returns whole minutes
 * or throws with a human-readable message (controller maps to 400).
 */
export function parseLateGraceMinutes(input: unknown): number {
    const value = typeof input === 'string' ? Number(input) : (input as number);
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error('lateGraceMinutes must be a number');
    }
    if (value < MIN_LATE_GRACE_MINUTES || value > MAX_LATE_GRACE_MINUTES) {
        throw new Error(`lateGraceMinutes must be between ${MIN_LATE_GRACE_MINUTES} and ${MAX_LATE_GRACE_MINUTES}`);
    }
    return Math.round(value);
}

export function parseBooleanSetting(input: unknown, name: string): boolean {
    if (typeof input === 'boolean') return input;
    throw new Error(`${name} must be a boolean`);
}

export function parseDepositMinSize(input: unknown): number {
    const value = typeof input === 'string' ? Number(input) : (input as number);
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error('depositMinSize must be a number');
    }
    if (!Number.isInteger(value) || value < MIN_DEPOSIT_SIZE || value > MAX_DEPOSIT_SIZE) {
        throw new Error(`depositMinSize must be an integer between ${MIN_DEPOSIT_SIZE} and ${MAX_DEPOSIT_SIZE}`);
    }
    return value;
}
export function parseTurnoverMinutes(input: unknown): number {
    const value = typeof input === 'string' ? Number(input) : (input as number);
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error('tableTurnoverMinutes must be a number');
    }
    if (!Number.isInteger(value) || value < MIN_TURNOVER_MINUTES || value > MAX_TURNOVER_MINUTES) {
        throw new Error(`tableTurnoverMinutes must be an integer between ${MIN_TURNOVER_MINUTES} and ${MAX_TURNOVER_MINUTES}`);
    }
    return value;
}

/** GDPR retention window in months (1-36). */
export function parseRetentionMonths(input: unknown): number {
    const value = typeof input === 'string' ? Number(input) : (input as number);
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error('retentionMonths must be a number');
    }
    if (!Number.isInteger(value) || value < 1 || value > 36) {
        throw new Error('retentionMonths must be an integer between 1 and 36');
    }
    return value;
}

const toDTO = (row: { avgTicket: number; avgTicketLunch: number | null; avgTicketDinner: number | null; retentionMonths: number; floorPlanImageUrl: string | null; lateGraceMinutes: number; autoCancelLate: boolean; depositEnabled: boolean; depositMinSize: number; depositAmount: number; stripeAccountId: string | null; stripeOnboarded: boolean; openHours: unknown; tableTurnoverMinutes: number; updatedAt: Date }): RestaurantSettingsDTO => ({
    avgTicket: row.avgTicket,
    avgTicketLunch: row.avgTicketLunch,
    avgTicketDinner: row.avgTicketDinner,
    retentionMonths: row.retentionMonths,
    floorPlanImageUrl: row.floorPlanImageUrl,
    lateGraceMinutes: row.lateGraceMinutes,
    autoCancelLate: row.autoCancelLate,
    depositEnabled: row.depositEnabled,
    depositMinSize: row.depositMinSize,
    depositAmount: row.depositAmount,
    stripeAccountId: row.stripeAccountId,
    stripeOnboarded: row.stripeOnboarded,
    openHours: (row.openHours as OpenHours | null) ?? null,
    tableTurnoverMinutes: row.tableTurnoverMinutes,
    updatedAt: row.updatedAt.toISOString(),
});

/** Per-tenant settings row; created on demand so reads never 404. */
export async function getSettings(tenantId: string): Promise<RestaurantSettingsDTO> {
    const row = await prisma.restaurantSettings.upsert({
        where: { tenantId },
        update: {},
        create: { tenantId },
    });
    return toDTO(row);
}

export async function updateSettings(tenantId: string, input: { avgTicket?: unknown; avgTicketLunch?: unknown; avgTicketDinner?: unknown; retentionMonths?: unknown; lateGraceMinutes?: unknown; autoCancelLate?: unknown; depositEnabled?: unknown; depositMinSize?: unknown; depositAmount?: unknown; openHours?: unknown; tableTurnoverMinutes?: unknown }): Promise<RestaurantSettingsDTO> {
    const data: { avgTicket?: number; avgTicketLunch?: number | null; avgTicketDinner?: number | null; retentionMonths?: number; lateGraceMinutes?: number; autoCancelLate?: boolean; depositEnabled?: boolean; depositMinSize?: number; depositAmount?: number; openHours?: any; tableTurnoverMinutes?: number } = {};
    if (input.avgTicket !== undefined) {
        data.avgTicket = parseAvgTicket(input.avgTicket);
    }
    if (input.avgTicketLunch !== undefined) {
        data.avgTicketLunch = parseOptionalAvgTicket(input.avgTicketLunch, 'avgTicketLunch');
    }
    if (input.avgTicketDinner !== undefined) {
        data.avgTicketDinner = parseOptionalAvgTicket(input.avgTicketDinner, 'avgTicketDinner');
    }
    if (input.retentionMonths !== undefined) {
        data.retentionMonths = parseRetentionMonths(input.retentionMonths);
    }
    if (input.lateGraceMinutes !== undefined) {
        data.lateGraceMinutes = parseLateGraceMinutes(input.lateGraceMinutes);
    }
    if (input.autoCancelLate !== undefined) {
        data.autoCancelLate = parseBooleanSetting(input.autoCancelLate, 'autoCancelLate');
    }
    if (input.depositEnabled !== undefined) {
        data.depositEnabled = parseBooleanSetting(input.depositEnabled, 'depositEnabled');
    }
    if (input.depositMinSize !== undefined) {
        data.depositMinSize = parseDepositMinSize(input.depositMinSize);
    }
    if (input.depositAmount !== undefined) {
        data.depositAmount = parseDepositAmount(input.depositAmount);
    }
    if (input.openHours !== undefined) {
        const parsed = parseOpenHours(input.openHours);
        // Prisma Json: DbNull clears to SQL NULL (legacy default schedule).
        data.openHours = (parsed === null ? Prisma.DbNull : parsed) as any;
    }
    if (input.tableTurnoverMinutes !== undefined) {
        data.tableTurnoverMinutes = parseTurnoverMinutes(input.tableTurnoverMinutes);
    }
    const row = await prisma.restaurantSettings.upsert({
        where: { tenantId },
        update: data,
        create: { tenantId, ...data },
    });
    return toDTO(row);
}

export async function setFloorPlanImageUrl(tenantId: string, url: string | null): Promise<RestaurantSettingsDTO> {
    const row = await prisma.restaurantSettings.upsert({
        where: { tenantId },
        update: { floorPlanImageUrl: url },
        create: { tenantId, floorPlanImageUrl: url },
    });
    return toDTO(row);
}

/**
 * Ticket applied to a service: lunch/dinner override when set,
 * global avgTicket otherwise. Lunch = start before 15:00 restaurant time.
 */
export function ticketForService(startTime: Date, avgTicket: number, lunch: number | null, dinner: number | null): number {
    const hour = dayjs(startTime).tz(RESTAURANT_TZ).hour();
    if (hour < 15) return lunch ?? avgTicket;
    return dinner ?? avgTicket;
}

/**
 * Average ticket actually used for turnover estimates — always the tenant's
 * Settings value (never env). The Booking model has no per-guest spend
 * (no POS data), so turnover is an estimate: totalGuests × avgTicket,
 * echoed back as `avgTicket` so the frontend labels it honestly.
 */
export async function getAvgTicket(tenantId: string): Promise<number> {
    const row = await prisma.restaurantSettings.findUnique({ where: { tenantId } });
    if (row && Number.isFinite(row.avgTicket) && row.avgTicket > 0) return row.avgTicket;
    return DEFAULT_AVG_TICKET;
}
