import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FloorPlan } from '../components/FloorPlan';
import { useBookingsContext } from '../context/useBookingsContext';
import { LanguageProvider } from '../i18n/LanguageContext';

vi.mock('../context/useBookingsContext', () => ({
    useBookingsContext: vi.fn(),
}));

(useBookingsContext as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({ bookings: [] });

describe('FloorPlan', () => {
    it('renders tables correctly', () => {
        render(
            <LanguageProvider>
                <FloorPlan hoveredBookingId={null} selectedDate="2024-01-01" />
            </LanguageProvider>
        );

        // Check for specific tables from floorPlanData
        // e.g. Table 10, 11, etc. 
        // The FloorPlan renders divs with text content or specific IDs if accessible.
        // Let's assume it renders names:
        expect(screen.getByText('10')).toBeInTheDocument();
        expect(screen.getByText('9')).toBeInTheDocument();
    });

    it('exposes the fullscreen expand/collapse toggle', () => {
        render(
            <LanguageProvider>
                <FloorPlan hoveredBookingId={null} selectedDate="2024-01-01" />
            </LanguageProvider>
        );

        // Expand button must always be present in the map controls.
        const expand = screen.getByTitle(/Expand map|Agrandir la carte/);
        expect(expand).toBeInTheDocument();
        fireEvent.click(expand);
        expect(screen.getByTitle(/Exit expanded map|Quitter le plein écran/)).toBeInTheDocument();
    });
});
