export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export const BOOKING_TAGS = ['VIP', 'ALLERGY', 'BIRTHDAY', 'STROLLER'] as const;
export type BookingTag = (typeof BOOKING_TAGS)[number];

export interface Table {
    id: number;
    name: string;
    capacity: number;
}

export interface Booking {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    language?: string; // e.g. 'fr', 'en', 'it', 'es', 'ru', etc.
    size: number;
    startTime: string;
    endTime: string;
    lowTable: boolean;
    status: BookingStatus;
    /** Who cancelled: 'HOST' (manual) or 'AUTO' (no-show sweep). */
    cancelledBy?: string | null;
    /** Staff tags: VIP, ALLERGY, BIRTHDAY, STROLLER. */
    tags?: string[];
    allergyNote?: string | null;
    birthdayDate?: string | null;
    vipNote?: string | null;
    guestConfirmed?: boolean;
    seatedAt?: string | null;
    leftAt?: string | null;
    source?: 'RESERVATION' | 'WALKIN';
    tables: Table[];
}

export interface CreateBookingPayload {
    name: string;
    phone?: string;
    email?: string;
    size: number;
    source?: 'RESERVATION' | 'WALKIN';
    language?: string;
    lowTable?: boolean;
    tags?: string[];
    allergyNote?: string | null;
    birthdayDate?: string | null;
    vipNote?: string | null;
    startTime: string;
    notify?: boolean;
    turnstileToken?: string | null;
}


export interface AvailabilityResponse {
    available: boolean;
    tables: Table[];
    suggestions?: string[];
}

export interface HourlySlice {
    hour: string; // e.g. "19:00"
    bookings: number;
    guests: number;
    bookingsPct: number; // 0-100
    guestsPct: number; // 0-100
}

export interface Analytics {
    date: string;
    totalBookings: number;
    totalGuests: number;
    avgPartySize: number;
    turnover: number; // estimate = totalGuests * avgTicket
    avgTicket: number;
    peakHour: string; // "HH:00" arrival hour with most guests, or "—"
    peakHourGuests: number;
    occupancyRate: number; // 0-100
    tablesUsed: number;
    totalTables: number;
    growth: string; // e.g. "+12.5%" or "—"
    growthPct: number | null;
    hourlyBreakdown: HourlySlice[];
}
export interface DailyAvailability {
    time: string;
    available: boolean;
}

export interface RangeDay {
    date: string;
    bookings: number;
    guests: number;
    turnover: number;
    noShows: number;
    cancellations: number;
    walkins: number;
}

export interface RangeAnalytics {
    from: string;
    to: string;
    days: RangeDay[];
    totals: {
        bookings: number;
        guests: number;
        turnover: number;
        noShows: number;
        cancellations: number;
        noShowRate: number;
        cancelRate: number;
        walkins: number;
        walkinShare: number;
        estimatedWalkins: boolean;
    };
    turnover: { avgMinutes: number; realShare: number };
    sizeBands: { label: '2' | '4' | '6+'; bookings: number; guests: number }[];
    heatmap: { dow: number; hour: string; bookings: number; guests: number }[];
    crm: {
        newClients: number;
        returningClients: number;
        top: { name: string; visits: number; noShows: number; lastVisit: string }[];
    };
    avgTicketLunch: number | null;
    avgTicketDinner: number | null;
}

export interface RestaurantSettings {
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

export type LayoutTableType = 'RECTANGULAR' | 'OCTAGONAL' | 'CAPSULE' | 'ROUND' | 'SQUARE' | 'BAR';

export interface LayoutTable {
    id: number;
    name: string;
    capacity: number;
    type: LayoutTableType;
    x: number | null;
    y: number | null;
    width: number;
    height: number;
    rotation: number;
    adjacentNames: string[];
}

export interface TenantContext {
    id: string;
    name: string;
    slug: string;
    trialEndsAt: string;
    trialActive: boolean;
    onboardingComplete: boolean;
}
