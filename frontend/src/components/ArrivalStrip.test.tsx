import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import dayjs, { RESTAURANT_TZ } from '../utils/dayjs';
import { ArrivalStrip } from './ArrivalStrip';
import { useBookingsForDate, useBookingsActions } from '../hooks/useBookings';
import { useRestaurantSettings } from '../hooks/useFloorPlan';
import { LanguageProvider } from '../i18n/LanguageContext';

vi.mock('../hooks/useBookings', () => ({
    useBookingsForDate: vi.fn(),
    useBookingsActions: vi.fn(),
    useMonthAffluence: vi.fn(() => ({})),
}));

vi.mock('../hooks/useFloorPlan', async importOriginal => {
    const mod = await importOriginal<typeof import('../hooks/useFloorPlan')>();
    return { ...mod, useRestaurantSettings: vi.fn() };
});

const useForDate = useBookingsForDate as unknown as { mockReturnValue: (v: unknown) => void };
const useActions = useBookingsActions as unknown as { mockReturnValue: (v: unknown) => void };
const useSettings = useRestaurantSettings as unknown as { mockReturnValue: (v: unknown) => void };
const checkIn = vi.fn();
const cancelBooking = vi.fn();

const at = (hour: number) => dayjs().startOf('day').add(hour, 'hour').toISOString();

const booking = (overrides: object) => ({
    id: `b-${Math.random()}`,
    name: 'Guest',
    size: 2,
    startTime: at(21),
    endTime: at(23),
    status: 'CONFIRMED',
    tables: [],
    language: 'fr',
    lowTable: false,
    ...overrides,
});

const renderStrip = (bookings: object[], onHighlight = vi.fn()) => {
    useForDate.mockReturnValue(bookings);
    useActions.mockReturnValue({ checkIn, cancelBooking });
    // Same restaurant-tz day as the bookings (avoids midnight-crossing flakes).
    const first = bookings[0] as { startTime?: string } | undefined;
    const date = dayjs(first?.startTime).tz(RESTAURANT_TZ).format('YYYY-MM-DD');
    render(
        <LanguageProvider>
            <ArrivalStrip date={date} onHighlight={onHighlight} />
        </LanguageProvider>,
    );
    return onHighlight;
};

describe('ArrivalStrip', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useSettings.mockReturnValue({ settings: { lateGraceMinutes: 15 }, loading: false, refresh: vi.fn() });
    });

    it('sorts late arrivals before upcoming ones', () => {
        const upcoming = booking({ id: 'up', name: 'Zoe-Up', startTime: at(13) });
        const late = booking({ id: 'late', name: 'Ann-Late', startTime: at(12) });
        renderStrip([upcoming, late]);
        const items = screen.getAllByRole('listitem');
        expect(items[0].textContent).toMatch(/Ann-Late/);
        expect(items[1].textContent).toMatch(/Zoe-Up/);
    });

    it('shows an empty state when nothing is open', () => {
        renderStrip([]);
        expect(screen.getByText(/No upcoming arrivals|Aucune arrivée/)).toBeInTheDocument();
    });

    it('expands Valider on tap and checks in', async () => {
        const b = booking({ id: 'b1', name: 'Marc' });
        const onHighlight = renderStrip([b]);
        fireEvent.click(screen.getByText('Marc'));
        expect(onHighlight).toHaveBeenCalledWith('b1');
        fireEvent.click(screen.getByRole('button', { name: /Seat|Installer/ }));
        await waitFor(() => expect(checkIn).toHaveBeenCalledWith('b1'));
    });

    it('cancels only on the second tap (two-tap confirm)', async () => {
        const b = booking({ id: 'b2', name: 'Lea' });
        renderStrip([b]);
        fireEvent.click(screen.getByText('Lea'));
        const cancelBtn = screen.getByRole('button', { name: /Cancel booking|Annuler la résa/ });
        fireEvent.click(cancelBtn); // arms
        expect(cancelBooking).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: /Confirm|Confirmer/ }));
        await waitFor(() => expect(cancelBooking).toHaveBeenCalledWith('b2'));
    });
});
