import type { Booking, AvailabilityResponse, CreateBookingPayload, Analytics, DailyAvailability, RestaurantSettings, LayoutTable } from '../types/index';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const FILE_BASE_URL = API_BASE_URL.replace(/\/api$/, '');

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

    put<T>(endpoint: string, options?: RequestOptions) {
        return this.request<T>('PUT', endpoint, options);
    }

    delete<T>(endpoint: string, options?: RequestOptions) {
        return this.request<T>('DELETE', endpoint, options);
    }

    /** Multipart upload (no JSON content-type; browser sets the boundary). */
    async upload<T>(endpoint: string, formData: FormData, auth = true): Promise<T> {
        const headers: HeadersInit = {};
        if (auth) {
            const token = localStorage.getItem('token');
            if (token) headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch(`${this.baseUrl}${endpoint}`, { method: 'POST', headers, body: formData });
        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.error || `Request failed with status ${res.status}`);
        }
        return res.json();
    }
}

const client = new ApiClient(API_BASE_URL);

export const api = {
    fetchBookings: () =>
        client.get<Booking[]>('/bookings', { auth: true }),

    getAnalytics: (date: string) =>
        client.get<Analytics>('/analytics', { params: { date }, auth: true }),

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

    // Demo-only endpoint (backend enforces the demo session).
    autoConsec: (date: string) =>
        client.post<unknown>('/tests/auto-consec', { body: { date }, auth: true }),

    // ── Tenant settings ──
    getSettings: () =>
        client.get<RestaurantSettings>('/settings', { auth: true }),

    updateSettings: (data: { avgTicket: number }) =>
        client.patch<RestaurantSettings>('/settings', { body: data, auth: true }),

    uploadFloorPlanImage: (file: File) => {
        const formData = new FormData();
        formData.append('image', file);
        return client.upload<RestaurantSettings>('/settings/floor-plan-image', formData, true);
    },

    // ── Floor-plan layout (geometry + manual adjacency) ──
    getLayout: () =>
        client.get<LayoutTable[]>('/tables'),

    saveLayout: (tables: LayoutTable[], deleteIds: number[]) =>
        client.put<LayoutTable[]>('/tables/layout', { body: { tables, deleteIds }, auth: true }),
};

/** Absolute URL for a backend-served upload path (e.g. /uploads/…). */
export const fileUrl = (path: string | null): string | null => {
    if (!path) return null;
    if (/^https?:\/\//.test(path)) return path;
    return `${FILE_BASE_URL}${path}`;
};
