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
    status: BookingStatus;
    tables: Table[];
}

export interface CreateBookingPayload {
    name: string;
    phone?: string;
    email?: string;
    size: number;
    language?: string;
    startTime: string;
}


export interface AvailabilityResponse {
    available: boolean;
    tables: Table[];
}

export interface Analytics {
    totalBookings: number;
    turnover: number;
    peakHour: string;
    growth: string; // e.g. "+12%"
}
