import type { Booking, AvailabilityResponse, CreateBookingPayload, Analytics, RangeAnalytics, DailyAvailability, RestaurantSettings, LayoutTable, TenantContext, ReconciliationHold, OpenDaySlots, OpenHours } from '../types/index';

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
            const err = new Error(error.error || `Request failed with status ${res.status}`) as Error & {
                status?: number;
                upcomingCount?: number;
                suggestion?: string[];
            };
            err.status = res.status;
            if (typeof error.upcomingCount === 'number') err.upcomingCount = error.upcomingCount;
            if (Array.isArray(error.suggestion)) err.suggestion = error.suggestion.map(String);
            throw err;
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
    register: (email: string, password: string, restaurantName: string, turnstileToken?: string) =>
        client.post<{ message: string; tenant: { slug: string; trialEndsAt: string } }>('/auth/register', { body: { email, password, restaurantName, turnstileToken } }),

    verifyEmail: (token: string) =>
        client.post<{ accessToken: string; refreshToken: string; tenant: { slug: string; trialEndsAt: string } | null }>('/auth/verify-email', { body: { token } }),

    resendVerification: (email: string) =>
        client.post<{ message: string }>('/auth/resend-verification', { body: { email } }),

    getTenant: () =>
        client.get<TenantContext>('/tenants/me', { auth: true }),

    /** Current user (role drives owner-only UI). Null when signed out. */
    getMe: () =>
        client.get<{ id: string; email: string; role: 'OWNER' | 'STAFF'; tenantId: string }>('/auth/me', { auth: true }),

    getUsers: () =>
        client.get<{ id: string; email: string; role: string; emailVerified: string | null; createdAt: string }[]>('/users', { auth: true }),

    createUser: (data: { email: string; password: string; role: 'OWNER' | 'STAFF' }) =>
        client.post<{ id: string; email: string; role: string }>('/users', { body: data, auth: true }),

    deleteUser: (id: string) =>
        client.delete<{ removed: boolean }>(`/users/${id}`, { auth: true }),

    /** Public marketing counter shown in the hero. Sandboxes are excluded. */
    getOnboardedRestaurants: () =>
        client.get<{ count: number }>('/stats/restaurants'),

    updateTenant: (data: { name?: string; slug?: string; onboardingComplete?: boolean }) =>
        client.patch<TenantContext>('/tenants/me', { body: data, auth: true }),

    checkSlug: (slug: string) =>
        client.get<{ slug: string; available: boolean }>('/tenants/slug-available', { params: { slug } }),

    /**
     * Tenant bookings. Pass a `date` (YYYY-MM-DD, restaurant timezone) to load
     * a single service; omit it for the full history (demo seeding, exports).
     */
    fetchBookings: (date?: string) =>
        client.get<Booking[]>('/bookings', { params: date ? { date } : undefined, auth: true }),

    /** Per-day booking counts for a month (`YYYY-MM`) — agenda calendar dots. */
    getAffluence: (month: string) =>
        client.get<Record<string, number>>('/bookings/affluence', { params: { month }, auth: true }),

    getAnalytics: (date: string) =>
        client.get<Analytics>('/analytics', { params: { date }, auth: true }),

    getRangeAnalytics: (from: string, to: string) =>
        client.get<RangeAnalytics>('/analytics/range', { params: { from, to }, auth: true }),

    checkAvailability: (date: string, time: string, size: number, slug: string) =>
        client.get<AvailabilityResponse>('/availability', { params: { date, time, size, slug } }),

    getDailyAvailability: (date: string, size: number, slug: string) =>
        client.get<DailyAvailability[]>('/daily-availability', { params: { date, size, slug } }),

    /** Public opening-hours grid for a date (booking widget). Hours only. */
    getOpenHours: (date: string, slug: string) =>
        client.get<OpenDaySlots>('/hours', { params: { date, slug } }),

    createBooking: (data: Partial<CreateBookingPayload>, slug: string) =>
        client.post<Booking>('/bookings', { body: { ...data, slug } }),

    updateAssignment: (id: string, tableNames: string[]) =>
        client.patch<Booking>(`/bookings/${id}/tables`, { body: { tableNames }, auth: true }),

    /** Host reschedule: move time and/or size, keeping tables when compatible. */
    rescheduleBooking: (id: string, data: { startTime?: string; size?: number; tableNames?: string[] }) =>
        client.patch<Booking>(`/bookings/${id}`, { body: data, auth: true }),

    checkIn: (id: string) =>
        client.post<Booking>(`/bookings/${id}/check-in`, { auth: true }),

    /** Host ends the meal: sets leftAt, frees the table for turnover stats. */
    finishMeal: (id: string) =>
        client.post<Booking>(`/bookings/${id}/finish`, { auth: true }),

    cancelBooking: (id: string) =>
        client.post<Booking>(`/bookings/${id}/cancel`, { auth: true }),

    /** GDPR Art.17: soft-delete + PII wipe (host, past bookings). */
    eraseBooking: (id: string) =>
        client.delete<{ erased: boolean }>(`/bookings/${id}`, { auth: true }),

    // Demo-only endpoint (backend enforces the demo session).
    autoConsec: (date: string) =>
        client.post<unknown>('/tests/auto-consec', { body: { date }, auth: true }),

    /** Demo-only database refill (backend enforces demo session + demo slug). */
    seedDemo: () =>
        client.post<{ message: string; bookings: number; tableLinks: number; tables: number }>('/tests/seed-demo', { auth: true }),

    /** Stripe Connect Express onboarding for this restaurant (owner). */
    stripeConnect: () =>
        client.post<{ url: string; accountId: string }>('/stripe/connect', { auth: true }),

    stripeStatus: () =>
        client.get<{ configured: boolean; mode: 'test' | 'live' | 'unconfigured'; accountId: string | null; onboarded: boolean }>('/stripe/status', { auth: true }),

    /**
     * Fail-safe holds — explicit staff triggers only (no auto-capture anywhere).
     * markNoShowAndCharge is the SOLE capture path (HELD → CAPTURED);
     * checkIn/cancel release the hold (HELD → RELEASED).
     */
    markNoShowAndCharge: (id: string) =>
        client.post<Booking>(`/bookings/${id}/no-show`, { auth: true }),

    /** End-of-shift reconciliation: unresolved HELD holds from the last 24h. */
    getReconciliationHolds: () =>
        client.get<ReconciliationHold[]>('/bookings/reconciliation', { auth: true }),

    // ── Tenant settings ──
    getSettings: () =>
        client.get<RestaurantSettings>('/settings', { auth: true }),

    updateSettings: (data: { avgTicket?: number; avgTicketLunch?: number | null; avgTicketDinner?: number | null; retentionMonths?: number; lateGraceMinutes?: number; autoCancelLate?: boolean; depositEnabled?: boolean; depositMinSize?: number; depositAmount?: number; openHours?: Exclude<OpenHours, null> | null; tableTurnoverMinutes?: number }) =>
        client.patch<RestaurantSettings>('/settings', { body: data, auth: true }),

    /** Host toggle for the guest-confirmed flag. */
    toggleGuestConfirm: (id: string, confirmed?: boolean) =>
        client.post<Booking>(`/bookings/${id}/guest-confirm`, { body: { confirmed }, auth: true }),

    uploadFloorPlanImage: (file: File) => {
        const formData = new FormData();
        formData.append('image', file);
        return client.upload<RestaurantSettings>('/settings/floor-plan-image', formData, true);
    },

    deleteFloorPlanImage: () =>
        client.delete<RestaurantSettings>('/settings/floor-plan-image', { auth: true }),

    // ── Floor-plan layout (geometry + manual adjacency) ──
    getLayout: (slug: string) =>
        client.get<LayoutTable[]>('/tables', { params: { slug } }),

    saveLayout: (
        tables: Array<Omit<LayoutTable, 'id'> & { id?: number }>,
        deleteIds: number[],
        confirmDeleteReservations = false,
    ) =>
        client.put<LayoutTable[]>('/tables/layout', {
            body: { tables, deleteIds, confirmDeleteReservations },
            auth: true,
        }),

    /** Gemini Vision detection: image → table draft (review before saving, never writes). */
    analyzeFloorPlanImage: (file: File) => {
        const formData = new FormData();
        formData.append('image', file);
        return client.upload<{ tables: LayoutTable[]; warnings: string[] }>('/tables/analyze-image', formData, true);
    },
};

/** Absolute URL for a backend-served upload path (e.g. /uploads/…). */
export const fileUrl = (path: string | null): string | null => {
    if (!path) return null;
    if (/^https?:\/\//.test(path)) return path;
    return `${FILE_BASE_URL}${path}`;
};
