import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import dayjs from 'dayjs';
import { ArrivalStrip } from './ArrivalStrip';
import { useBookingsContext } from '../context/useBookingsContext';
import { useRestaurantSettings } from '../hooks/useFloorPlan';
import { api } from '../services/api';
import { LanguageProvider } from '../i18n/LanguageContext';

vi.mock('../context/useBookingsContext', () => ({
    useBookingsContext: vi.fn(),
}));

vi.mock('../hooks/useFloorPlan', async importOriginal => {
    const mod = await importOriginal<typeof import('../hooks/useFloorPlan')>();
    return { ...mod, useRestaurantSettings: vi.fn() };
});

vi.mock('../services/api', () => ({
    api: {
        checkIn: vi.fn(),
        cancelBooking: vi.fn(),
    },
}));

const ctx = useBookingsContext as unknown as { mockReturnValue: (v: unknown) => void };
const useSettings = useRestaurantSettings as unknown as { mockReturnValue: (v: unknown) => void };
const checkIn = api.checkIn as unknown as ReturnType<typeof vi.fn>;
const cancelBooking = api.cancelBooking as unknown as ReturnType<typeof vi.fn>;

const booking = (overrides: object) => ({
    id: `b-${Math.random()}`,
    name: 'Guest',
    size: 2,
    startTime: dayjs().add(3, 'hour').toISOString(),
    endTime: dayjs().add(5, 'hour').toISOString(),
    status: 'CONFIRMED',
    tables: [],
    language: 'fr',
    lowTable: false,
    ...overrides,
});

const renderStrip = (bookings: object[], onHighlight = vi.fn()) => {
    ctx.mockReturnValue({ bookings, refresh: vi.fn() });
    render(
        <LanguageProvider>
            <ArrivalStrip date={dayjs().format('YYYY-MM-DD')} onHighlight={onHighlight} />
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
        const upcoming = booking({ id: 'up', name: 'Zoe-Up', startTime: dayjs().add(3, 'hour').toISOString() });
        const late = booking({ id: 'late', name: 'Ann-Late', startTime: dayjs().subtract(60, 'minute').toISOString() });
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
