import type { Booking, AvailabilityResponse } from '../types/index';

const API_BASE_URL = 'http://localhost:3000/api';

export const api = {
    async fetchBookings(): Promise<Booking[]> {
        const res = await fetch(`${API_BASE_URL}/bookings`);
        if (!res.ok) throw new Error('Failed to fetch bookings');
        return res.json();
    },

    async checkAvailability(date: string, time: string, size: number): Promise<AvailabilityResponse> {
        const res = await fetch(`${API_BASE_URL}/availability?date=${date}&time=${time}&size=${size}`);
        if (!res.ok) throw new Error('Failed to check availability');
        return res.json();
    },

    async createBooking(data: Partial<Booking>): Promise<Booking> {
        const res = await fetch(`${API_BASE_URL}/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Failed to create booking');
        }
        return res.json();
    },

    async updateAssignment(id: string, tableNames: string[]): Promise<Booking> {
        const res = await fetch(`${API_BASE_URL}/bookings/${id}/tables`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tableNames })
        });
        if (!res.ok) throw new Error('Failed to update assignment');
        return res.json();
    },

    async checkIn(id: string): Promise<Booking> {
        const res = await fetch(`${API_BASE_URL}/bookings/${id}/check-in`, { method: 'POST' });
        if (!res.ok) throw new Error('Failed to check-in');
        return res.json();
    },

    async cancelBooking(id: string): Promise<Booking> {
        const res = await fetch(`${API_BASE_URL}/bookings/${id}/cancel`, { method: 'POST' });
        if (!res.ok) throw new Error('Failed to cancel booking');
        return res.json();
    }
};
