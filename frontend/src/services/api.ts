import type { Booking, AvailabilityResponse, CreateBookingPayload, Analytics, DailyAvailability } from '../types/index';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

type RequestOptions = {
    auth?: boolean;
    body?: unknown;
    params?: Record<string, string | number>;
};

class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    private buildUrl(endpoint: string, params?: Record<string, string | number>): string {
        if (!params) return `${this.baseUrl}${endpoint}`;
        const query = new URLSearchParams(
            Object.entries(params).map(([k, v]) => [k, String(v)])
        ).toString();
        return `${this.baseUrl}${endpoint}?${query}`;
    }

    private getHeaders(auth: boolean): HeadersInit {
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (auth) {
            const token = localStorage.getItem('token');
            if (token) headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }

    private async request<T>(method: string, endpoint: string, options: RequestOptions = {}): Promise<T> {
        const { auth = false, body, params } = options;
        const url = this.buildUrl(endpoint, params);

        const res = await fetch(url, {
            method,
            headers: this.getHeaders(auth),
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.error || `Request failed with status ${res.status}`);
        }
        return res.json();
    }

    get<T>(endpoint: string, options?: RequestOptions) {
        return this.request<T>('GET', endpoint, options);
    }

    post<T>(endpoint: string, options?: RequestOptions) {
        return this.request<T>('POST', endpoint, options);
    }

    patch<T>(endpoint: string, options?: RequestOptions) {
        return this.request<T>('PATCH', endpoint, options);
    }
}

const client = new ApiClient(API_BASE_URL);

export const api = {
    fetchBookings: () =>
        client.get<Booking[]>('/bookings', { auth: true }),

    getAnalytics: (date: string) =>
        client.get<Analytics>('/analytics', { params: { date } }),

    checkAvailability: (date: string, time: string, size: number) =>
        client.get<AvailabilityResponse>('/availability', { params: { date, time, size } }),

    getDailyAvailability: (date: string, size: number) =>
        client.get<DailyAvailability[]>('/daily-availability', { params: { date, size } }),

    createBooking: (data: Partial<CreateBookingPayload>) =>
        client.post<Booking>('/bookings', { body: data }),

    updateAssignment: (id: string, tableNames: string[]) =>
        client.patch<Booking>(`/bookings/${id}/tables`, { body: { tableNames }, auth: true }),

    checkIn: (id: string) =>
        client.post<Booking>(`/bookings/${id}/check-in`, { auth: true }),

    cancelBooking: (id: string) =>
        client.post<Booking>(`/bookings/${id}/cancel`, { auth: true }),

    autoConsec: (date: string) =>
        client.post<any>('/tests/auto-consec', { body: { date } }),
};
