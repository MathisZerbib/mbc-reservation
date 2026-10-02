import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Booking } from '../types';

vi.mock('../services/api', () => ({
    api: {
        fetchBookings: vi.fn(),
        getAffluence: vi.fn(),
        cancelBooking: vi.fn(),
        checkIn: vi.fn(),
        toggleGuestConfirm: vi.fn(),
        finishMeal: vi.fn(),
        updateAssignment: vi.fn(),
        rescheduleBooking: vi.fn(),
        createBooking: vi.fn(),
        eraseBooking: vi.fn(),
        markNoShowAndCharge: vi.fn(),
        autoConsec: vi.fn(),
    },
}));

vi.mock('../services/socket', () => ({
    socket: { on: vi.fn() },
}));

import { api } from '../services/api';
import { socket } from '../services/socket';
import { useBookingsStore, dayKey, bindBookingsSocket } from './bookingsStore';

const fetchBookings = api.fetchBookings as ReturnType<typeof vi.fn>;
const cancelBooking = api.cancelBooking as ReturnType<typeof vi.fn>;
const socketOn = socket.on as unknown as ReturnType<typeof vi.fn>;

const makeBooking = (overrides: Partial<Booking> = {}): Booking => ({
    id: 'b1',
    name: 'Guest',
    size: 2,
    startTime: '2026-10-02T19:00:00.000Z',
    endTime: '2026-10-02T21:00:00.000Z',
    lowTable: false,
    status: 'CONFIRMED',
    tables: [],
    ...overrides,
});

const reset = () =>
    useBookingsStore.setState({
        byId: {},
        loadedDates: {},
        loadingDates: {},
        affluenceByMonth: {},
        error: null,
    });

describe('bookingsStore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        reset();
    });

    it('de-duplicates concurrent day loads (single-flight)', async () => {
        const date = dayKey(makeBooking().startTime);
        fetchBookings.mockResolvedValue([makeBooking()]);

        const store = useBookingsStore.getState();
        await Promise.all([store.ensureDay(date), store.ensureDay(date)]);

        expect(fetchBookings).toHaveBeenCalledTimes(1);
        expect(useBookingsStore.getState().loadedDates[date]).toBe(true);
    });

    it('does not refetch an already-loaded day', async () => {
        const date = dayKey(makeBooking().startTime);
        fetchBookings.mockResolvedValue([makeBooking()]);

        await useBookingsStore.getState().ensureDay(date);
        await useBookingsStore.getState().ensureDay(date);

        expect(fetchBookings).toHaveBeenCalledTimes(1);
    });

    it('patches from a socket payload without any fetch', () => {
        const b = makeBooking();
        useBookingsStore.getState().upsert(b);

        expect(fetchBookings).not.toHaveBeenCalled();
        expect(useBookingsStore.getState().byId[b.id]).toEqual(b);
    });

    it('replaces only the requested day, keeping other days', async () => {
        const day1 = makeBooking({ id: 'd1', startTime: '2026-10-02T19:00:00.000Z' });
        const day2 = makeBooking({ id: 'd2', startTime: '2026-10-03T19:00:00.000Z' });
        const date1 = dayKey(day1.startTime);
        const date2 = dayKey(day2.startTime);

        fetchBookings.mockResolvedValueOnce([day1]);
        await useBookingsStore.getState().ensureDay(date1);
        fetchBookings.mockResolvedValueOnce([day2]);
        await useBookingsStore.getState().ensureDay(date2);

        expect(useBookingsStore.getState().byId.d1).toBeTruthy();
        expect(useBookingsStore.getState().byId.d2).toBeTruthy();
    });

    it('applies an optimistic cancel and keeps the server row', async () => {
        const b = makeBooking();
        useBookingsStore.setState({ byId: { b1: b } });
        cancelBooking.mockResolvedValue({ ...b, status: 'CANCELLED', cancelledBy: 'HOST' });

        await useBookingsStore.getState().cancelBooking('b1');

        expect(useBookingsStore.getState().byId.b1.status).toBe('CANCELLED');
    });

    it('rolls back an optimistic cancel when the request fails', async () => {
        const b = makeBooking();
        useBookingsStore.setState({ byId: { b1: b } });
        cancelBooking.mockRejectedValue(new Error('boom'));

        await expect(useBookingsStore.getState().cancelBooking('b1')).rejects.toThrow('boom');
        expect(useBookingsStore.getState().byId.b1.status).toBe('CONFIRMED');
    });

    it('patches on socket events (bindBookingsSocket)', () => {
        bindBookingsSocket();
        const handler = socketOn.mock.calls.find(c => c[0] === 'booking-update')?.[1] as
            | ((p: { booking?: Booking }) => void)
            | undefined;
        expect(handler).toBeTypeOf('function');

        const b = makeBooking({ id: 'sock' });
        handler?.({ booking: b });

        expect(useBookingsStore.getState().byId.sock).toEqual(b);
        expect(fetchBookings).not.toHaveBeenCalled();
    });
});