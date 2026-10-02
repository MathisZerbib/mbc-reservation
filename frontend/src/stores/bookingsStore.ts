import { create } from 'zustand';
import dayjs, { RESTAURANT_TZ } from '../utils/dayjs';
import { api } from '../services/api';
import { socket } from '../services/socket';
import type { Booking, CreateBookingPayload } from '../types';

/**
 * Single source of truth for bookings on the host surface.
 *
 * Why a store (and not a per-component fetch hook):
 * - the server pushes the updated booking on every mutation (`booking-update`),
 *   so a mutation must NOT trigger a refetch — we patch the row locally;
 * - day lists are loaded lazily and de-duplicated (single-flight), so a page
 *   load issues exactly one request per visible day, never one per component.
 */

/** Restaurant-day key (YYYY-MM-DD, Europe/Paris) for a booking. */
export const dayKey = (iso: string): string => dayjs(iso).tz(RESTAURANT_TZ).format('YYYY-MM-DD');

const omit = <T extends object>(obj: T, key: string): T => {
  if (!(key in obj)) return obj;
  const next = { ...obj } as Record<string, unknown>;
  delete next[key];
  return next as T;
};

const messageOf = (e: unknown): string =>
  e instanceof Error ? e.message : 'An unknown error occurred';

/** Payload of the `booking-update` socket event (booking omitted on sweeps). */
interface BookingUpdateEvent {
  type?: string;
  booking?: Booking | null;
  /** Present on GDPR erases — the row is gone, drop it locally. */
  bookingId?: string;
}

interface BookingsState {
  /** Loaded bookings, keyed by id (only the days that were requested). */
  byId: Record<string, Booking>;
  /** Days already fetched — `ensureDay` is a no-op for these. */
  loadedDates: Record<string, true>;
  /** Days with an in-flight fetch (drives per-day loading UI). */
  loadingDates: Record<string, true>;
  /** Monthly affluence counts (day → bookings), keyed by `YYYY-MM`. */
  affluenceByMonth: Record<string, Record<string, number>>;
  error: string | null;

  // ── data loading ──
  ensureDay: (date: string) => Promise<void>;
  ensureAffluence: (month: string) => Promise<void>;
  refreshLoaded: () => Promise<void>;
  upsert: (booking: Booking) => void;
  remove: (id: string) => void;

  // ── mutations (optimistic, patched from the server response — no refetch) ──
  checkIn: (id: string) => Promise<void>;
  cancelBooking: (id: string) => Promise<void>;
  toggleGuestConfirm: (id: string) => Promise<void>;
  finishMeal: (id: string) => Promise<void>;
  updateAssignment: (id: string, tableNames: string[]) => Promise<Booking>;
  rescheduleBooking: (
    id: string,
    data: { startTime?: string; size?: number; tableNames?: string[] },
  ) => Promise<Booking>;
  createBooking: (data: Partial<CreateBookingPayload>, slug: string) => Promise<Booking>;
  eraseBooking: (id: string) => Promise<void>;
  markNoShowAndCharge: (id: string) => Promise<void>;
  autoConsec: (date: string) => Promise<void>;
}

/** In-flight loads, so concurrent callers share one request (single-flight). */
const pendingDays = new Map<string, Promise<void>>();
const pendingMonths = new Map<string, Promise<void>>();

export const useBookingsStore = create<BookingsState>((set, get) => {
  /** Replace one day's rows with the authoritative server list. */
  const applyDay = (date: string, list: Booking[]) =>
    set((s) => {
      const byId = { ...s.byId };
      for (const [id, b] of Object.entries(byId)) {
        if (dayKey(b.startTime) === date) delete byId[id];
      }
      for (const b of list) byId[b.id] = b;
      return {
        byId,
        loadedDates: { ...s.loadedDates, [date]: true },
        loadingDates: omit(s.loadingDates, date),
        error: null,
      };
    });

  const loadDay = (date: string, force = false): Promise<void> => {
    const inFlight = pendingDays.get(date);
    if (inFlight) return inFlight;
    if (!force && get().loadedDates[date]) return Promise.resolve();

    set((s) => ({ loadingDates: { ...s.loadingDates, [date]: true } }));
    const request = api
      .fetchBookings(date)
      .then((list) => applyDay(date, list))
      .catch((e) => set((s) => ({ loadingDates: omit(s.loadingDates, date), error: messageOf(e) })))
      .finally(() => {
        pendingDays.delete(date);
      });
    pendingDays.set(date, request);
    return request;
  };

  return {
    byId: {},
    loadedDates: {},
    loadingDates: {},
    affluenceByMonth: {},
    error: null,

    ensureDay: (date) => loadDay(date),

    ensureAffluence: (month) => {
      const inFlight = pendingMonths.get(month);
      if (inFlight) return inFlight;
      if (get().affluenceByMonth[month]) return Promise.resolve();

      const request = api
        .getAffluence(month)
        .then((counts) =>
          set((s) => ({ affluenceByMonth: { ...s.affluenceByMonth, [month]: counts } })),
        )
        .catch(() => undefined)
        .finally(() => {
          pendingMonths.delete(month);
        });
      pendingMonths.set(month, request);
      return request;
    },

    refreshLoaded: async () => {
      await Promise.all(Object.keys(get().loadedDates).map((d) => loadDay(d, true)));
    },

    upsert: (booking) => set((s) => ({ byId: { ...s.byId, [booking.id]: booking } })),

    remove: (id) =>
      set((s) => {
        if (!(id in s.byId)) return s;
        const byId = { ...s.byId };
        delete byId[id];
        return { byId };
      }),

    checkIn: async (id) => {
      const prev = get().byId[id];
      if (prev) get().upsert({ ...prev, status: 'COMPLETED', seatedAt: new Date().toISOString() });
      try {
        get().upsert(await api.checkIn(id));
      } catch (e) {
        if (prev) get().upsert(prev);
        throw e;
      }
    },

    cancelBooking: async (id) => {
      const prev = get().byId[id];
      if (prev) get().upsert({ ...prev, status: 'CANCELLED', cancelledBy: 'HOST' });
      try {
        get().upsert(await api.cancelBooking(id));
      } catch (e) {
        if (prev) get().upsert(prev);
        throw e;
      }
    },

    toggleGuestConfirm: async (id) => {
      const prev = get().byId[id];
      if (prev) get().upsert({ ...prev, guestConfirmed: !prev.guestConfirmed });
      try {
        get().upsert(await api.toggleGuestConfirm(id));
      } catch (e) {
        if (prev) get().upsert(prev);
        throw e;
      }
    },

    finishMeal: async (id) => {
      const prev = get().byId[id];
      if (prev) get().upsert({ ...prev, leftAt: new Date().toISOString() });
      try {
        get().upsert(await api.finishMeal(id));
      } catch (e) {
        if (prev) get().upsert(prev);
        throw e;
      }
    },

    updateAssignment: async (id, tableNames) => {
      const updated = await api.updateAssignment(id, tableNames);
      get().upsert(updated);
      return updated;
    },

    rescheduleBooking: async (id, data) => {
      const updated = await api.rescheduleBooking(id, data);
      get().upsert(updated);
      return updated;
    },

    createBooking: async (data, slug) => {
      const created = await api.createBooking(data, slug);
      get().upsert(created);
      return created;
    },

    eraseBooking: async (id) => {
      const prev = get().byId[id];
      get().remove(id);
      try {
        await api.eraseBooking(id);
      } catch (e) {
        if (prev) get().upsert(prev);
        throw e;
      }
    },

    markNoShowAndCharge: async (id) => {
      const prev = get().byId[id];
      if (prev) get().upsert({ ...prev, status: 'CANCELLED', cancelledBy: 'AUTO' });
      try {
        get().upsert(await api.markNoShowAndCharge(id));
      } catch (e) {
        if (prev) get().upsert(prev);
        throw e;
      }
    },

    autoConsec: async (date) => {
      await api.autoConsec(date);
      // Bulk server-side reshuffle: refetch the affected days (rare, staff-only).
      await get().refreshLoaded();
    },
  };
});

/** Latest store snapshot without subscribing (safe outside React). */
export const bookingsStore = () => useBookingsStore.getState();

let socketBound = false;

/**
 * Wire the realtime channel to the store exactly once. Mutations carry the
 * fresh booking → local patch (zero requests); payload-less sweeps fall back
 * to one coalesced refetch of the loaded days.
 */
export const bindBookingsSocket = (): void => {
  if (socketBound) return;
  socketBound = true;
  socket.on('booking-update', (payload: BookingUpdateEvent = {}) => {
    const store = bookingsStore();
    if (payload.bookingId) store.remove(payload.bookingId);
    else if (payload.booking) store.upsert(payload.booking);
    else void store.refreshLoaded();
  });
};