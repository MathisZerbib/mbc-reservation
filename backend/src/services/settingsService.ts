import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

import { prisma } from '../lib/prisma';

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

const toDTO = (row: { avgTicket: number; avgTicketLunch: number | null; avgTicketDinner: number | null; retentionMonths: number; floorPlanImageUrl: string | null; lateGraceMinutes: number; autoCancelLate: boolean; depositEnabled: boolean; depositMinSize: number; tableTurnoverMinutes: number; updatedAt: Date }): RestaurantSettingsDTO => ({
    avgTicket: row.avgTicket,
    avgTicketLunch: row.avgTicketLunch,
    avgTicketDinner: row.avgTicketDinner,
    retentionMonths: row.retentionMonths,
    floorPlanImageUrl: row.floorPlanImageUrl,
    lateGraceMinutes: row.lateGraceMinutes,
    autoCancelLate: row.autoCancelLate,
    depositEnabled: row.depositEnabled,
    depositMinSize: row.depositMinSize,
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

export async function updateSettings(tenantId: string, input: { avgTicket?: unknown; avgTicketLunch?: unknown; avgTicketDinner?: unknown; retentionMonths?: unknown; lateGraceMinutes?: unknown; autoCancelLate?: unknown; depositEnabled?: unknown; depositMinSize?: unknown; tableTurnoverMinutes?: unknown }): Promise<RestaurantSettingsDTO> {
    const data: { avgTicket?: number; avgTicketLunch?: number | null; avgTicketDinner?: number | null; retentionMonths?: number; lateGraceMinutes?: number; autoCancelLate?: boolean; depositEnabled?: boolean; depositMinSize?: number; tableTurnoverMinutes?: number } = {};
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
