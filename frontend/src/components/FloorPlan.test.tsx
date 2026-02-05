import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FloorPlan } from '../components/FloorPlan';
import { useBookingsContext } from '../context/useBookingsContext';

vi.mock('../context/useBookingsContext', () => ({
    useBookingsContext: vi.fn(),
}));

(useBookingsContext as any).mockReturnValue({ bookings: [] });

describe('FloorPlan', () => {
    it('renders tables correctly', () => {
        render(<FloorPlan hoveredBookingId={null} selectedDate="2024-01-01" />);

        // Check for specific tables from floorPlanData
        // e.g. Table 10, 11, etc. 
        // The FloorPlan renders divs with text content or specific IDs if accessible.
        // Let's assume it renders names:
        expect(screen.getByText('10')).toBeInTheDocument();
        expect(screen.getByText('9')).toBeInTheDocument();
    });
});
