import { render, screen } from '@testing-library/react';
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
});
