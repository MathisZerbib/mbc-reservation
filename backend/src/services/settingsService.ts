import { prisma } from '../lib/prisma';

export const SETTINGS_ID = 1;
export const MIN_AVG_TICKET = 1;
export const MAX_AVG_TICKET = 1000;

/** Starting value for fresh installs (tenant changes it in Settings). */
export const DEFAULT_AVG_TICKET = 55;

export interface RestaurantSettingsDTO {
    avgTicket: number;
    floorPlanImageUrl: string | null;
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

const toDTO = (row: { avgTicket: number; floorPlanImageUrl: string | null; updatedAt: Date }): RestaurantSettingsDTO => ({
    avgTicket: row.avgTicket,
    floorPlanImageUrl: row.floorPlanImageUrl,
    updatedAt: row.updatedAt.toISOString(),
});

/** Singleton settings row; created on demand so reads never 404. */
export async function getSettings(): Promise<RestaurantSettingsDTO> {
    const row = await prisma.restaurantSettings.upsert({
        where: { id: SETTINGS_ID },
        update: {},
        create: { id: SETTINGS_ID },
    });
    return toDTO(row);
}

export async function updateSettings(input: { avgTicket?: unknown }): Promise<RestaurantSettingsDTO> {
    const data: { avgTicket?: number } = {};
    if (input.avgTicket !== undefined) {
        data.avgTicket = parseAvgTicket(input.avgTicket);
    }
    const row = await prisma.restaurantSettings.upsert({
        where: { id: SETTINGS_ID },
        update: data,
        create: { id: SETTINGS_ID, ...data },
    });
    return toDTO(row);
}

export async function setFloorPlanImageUrl(url: string | null): Promise<RestaurantSettingsDTO> {
    const row = await prisma.restaurantSettings.upsert({
        where: { id: SETTINGS_ID },
        update: { floorPlanImageUrl: url },
        create: { id: SETTINGS_ID, floorPlanImageUrl: url },
    });
    return toDTO(row);
}

/**
 * Average ticket actually used for turnover estimates — always the tenant's
 * Settings value (never env). The Booking model has no per-guest spend
 * (no POS data), so turnover is an estimate: totalGuests × avgTicket,
 * echoed back as `avgTicket` so the frontend labels it honestly.
 */
export async function getAvgTicket(): Promise<number> {
    const row = await prisma.restaurantSettings.findUnique({ where: { id: SETTINGS_ID } });
    if (row && Number.isFinite(row.avgTicket) && row.avgTicket > 0) return row.avgTicket;
    return DEFAULT_AVG_TICKET;
}
