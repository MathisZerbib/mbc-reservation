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
    highTable?: boolean;
    tables?: Table[];
    createdAt?: Date;
    updatedAt?: Date;
}

export interface CreateReservationInput {
    name: string;
    phone?: string | null;
    email?: string | null;
    language?: string;
    size: number;
    startTime: Date;
    highTable?: boolean;
}
