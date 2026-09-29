export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

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
    tables: Table[];
}

export interface CreateBookingPayload {
    name: string;
    phone?: string;
    email?: string;
    size: number;
    language?: string;
    lowTable?: boolean;
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

export interface RestaurantSettings {
    avgTicket: number;
    floorPlanImageUrl: string | null;
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
