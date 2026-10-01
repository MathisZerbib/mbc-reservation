export interface Table {
    id: number;
    name: string;
    capacity?: number;
    type?: string;
    x?: number | null;
    y?: number | null;
}

export interface Booking {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    language: string;
    size: number;
    startTime: Date | string;
    endTime: Date | string;
    status?: string;
    lowTable?: boolean;
    tables?: Table[];
    tags?: string[];
    guestConfirmed?: boolean;
    seatedAt?: Date | string | null;
    createdAt?: Date;
    updatedAt?: Date;
}

export const BOOKING_TAGS = ['VIP', 'ALLERGY', 'BIRTHDAY', 'STROLLER'] as const;
export type BookingTag = (typeof BOOKING_TAGS)[number];

export interface CreateReservationInput {
    name: string;
    phone?: string | null;
    email?: string | null;
    language?: string;
    size: number;
    startTime: Date;
    lowTable?: boolean;
    tenantId: string;
    tags?: string[];
    allergyNote?: string | null;
    birthdayDate?: Date | string | null;
    vipNote?: string | null;
}
