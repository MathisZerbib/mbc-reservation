import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import dayjs from '../utils/dayjs';
import { useBookingsStore, dayKey } from '../stores/bookingsStore';
import type { Booking } from '../types';

const byStart = (a: Booking, b: Booking) => dayjs(a.startTime).unix() - dayjs(b.startTime).unix();

const EMPTY_AFFLUENCE: Record<string, number> = {};

/**
 * Bookings for one restaurant-day. Triggers the (single-flight) load of that
 * day; every consumer of the same date shares one request.
 */
export const useBookingsForDate = (date: string): Booking[] => {
  useEffect(() => {
    void useBookingsStore.getState().ensureDay(date);
  }, [date]);

  return useBookingsStore(
    useShallow((s) => Object.values(s.byId).filter((b) => dayKey(b.startTime) === date).sort(byStart)),
  );
};

/** Per-day booking counts for a month (agenda calendar dots). */
export const useMonthAffluence = (month: string): Record<string, number> => {
  useEffect(() => {
    void useBookingsStore.getState().ensureAffluence(month);
  }, [month]);

  return useBookingsStore((s) => s.affluenceByMonth[month] ?? EMPTY_AFFLUENCE);
};

/**
 * Stable mutation bundle (optimistic, patched in place). The selectors are
 * constant references, so calling this never re-renders a component.
 */
export const useBookingsActions = () =>
  useBookingsStore(
    useShallow((s) => ({
      checkIn: s.checkIn,
      cancelBooking: s.cancelBooking,
      toggleGuestConfirm: s.toggleGuestConfirm,
      finishMeal: s.finishMeal,
      updateAssignment: s.updateAssignment,
      rescheduleBooking: s.rescheduleBooking,
      createBooking: s.createBooking,
      eraseBooking: s.eraseBooking,
      markNoShowAndCharge: s.markNoShowAndCharge,
      autoConsec: s.autoConsec,
    })),
  );
