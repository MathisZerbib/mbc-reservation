export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export interface Table {
    id: number;
    name: string;
    capacity: number;
}

export interface Booking {
    id: string;
    guestName: string;
    guestPhone?: string;
    guestEmail?: string;
    size: number;
    startTime: string;
    endTime: string;
    status: BookingStatus;
    tables: Table[];
}

export interface AvailabilityResponse {
    available: boolean;
    tables: Table[];
}
