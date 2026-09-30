import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import dayjs, { RESTAURANT_TZ } from '../utils/dayjs';
import { FloorPlan } from './FloorPlan';
import { HostSearchBar } from './HostSearchBar';
import { HostHeader } from './HostHeader';
import { AdminQuickReservation } from './AdminQuickReservation';
import { TrialBanner } from './TrialBanner';
import { useBookingsContext } from '../context/useBookingsContext';
import { matchesHostQuery, countArrivalsNow } from '../utils/bookingUtils';
import { api } from '../services/api';

/**
 * Host live workspace: full-width floor map. The arrivals list lives on
 * /app/planning; placement deep-links here via ?place=<bookingId>.
 */
export const LivePage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedDate, setSelectedDate] = useState(
        searchParams.get('date') || dayjs.tz(undefined, RESTAURANT_TZ).format('YYYY-MM-DD'),
    );
    const [hostQuery, setHostQuery] = useState('');
    const [hoveredBookingId, setHoveredBookingId] = useState<string | null>(null);
    const [placementBookingId, setPlacementBookingId] = useState<string | null>(searchParams.get('place'));
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [isQuickResOpen, setIsQuickResOpen] = useState(false);
    const [quickTable, setQuickTable] = useState<string | null>(null);
    const { bookings, refresh } = useBookingsContext();

    const dayBookings = bookings.filter(
        b => dayjs(b.startTime).tz(RESTAURANT_TZ).format('YYYY-MM-DD') === selectedDate && b.status !== 'CANCELLED',
    );
    const arrivalsNow = countArrivalsNow(bookings, selectedDate, dayjs());
    const queryMatches = hostQuery.trim() === '' ? [] : dayBookings.filter(b => matchesHostQuery(b, hostQuery));
    const placementBooking = placementBookingId ? (bookings.find(b => b.id === placementBookingId) ?? null) : null;

    // Keep date + placement deep-linkable (?date=&?place=).
    useEffect(() => {
        const next: Record<string, string> = {};
        if (selectedDate) next.date = selectedDate;
        if (placementBookingId) next.place = placementBookingId;
        setSearchParams(next, { replace: true });
    }, [selectedDate, placementBookingId, setSearchParams]);

    const handleSearchSubmit = () => {
        if (queryMatches.length === 1) {
            const only = queryMatches[0];
            if (!only.tables || only.tables.length === 0) setPlacementBookingId(only.id);
            setHoveredBookingId(only.id);
        }
    };

    const handlePlacementSave = async (bookingId: string, tableNames: string[], andCheckIn: boolean) => {
        await api.updateAssignment(bookingId, tableNames);
        if (andCheckIn) {
            try {
                await api.checkIn(bookingId);
            } catch (e) {
                console.error('Check-in after placement failed', e);
            }
        }
        await refresh();
        setPlacementBookingId(null);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-3 lg:p-4 h-screen overflow-hidden flex flex-col">
            <div className="max-w-[1600px] mx-auto w-full flex flex-col h-full gap-4">
                <HostHeader date={selectedDate} arrivalsNow={arrivalsNow} onQuickRes={() => setIsQuickResOpen(true)} />
                <TrialBanner />
                <div className="flex-none">
                    <HostSearchBar
                        value={hostQuery}
                        onChange={setHostQuery}
                        matchCount={queryMatches.length}
                        onSubmit={handleSearchSubmit}
                    />
                </div>
                <div className="flex-1 min-h-[480px] overflow-hidden relative rounded-[2.5rem] bg-white shadow-xl shadow-slate-200/50 border border-slate-200/60">
                    <FloorPlan
                        hoveredBookingId={hoveredBookingId}
                        selectedDate={selectedDate}
                        initialViewMode="LIVE"
                        highlightBookingIds={queryMatches.map(b => b.id)}
                        placementBooking={placementBooking}
                        onPlacementSave={handlePlacementSave}
                        onPlacementCancel={() => setPlacementBookingId(null)}
                        selectedTableId={selectedTableId}
                        onSelectTable={setSelectedTableId}
                        onFocusBooking={setHostQuery}
                        onQuickCreate={tableId => {
                            setQuickTable(tableId);
                            setIsQuickResOpen(true);
                        }}
                    />
                </div>
            </div>

            <AdminQuickReservation
                isOpen={isQuickResOpen}
                onClose={() => {
                    setIsQuickResOpen(false);
                    setQuickTable(null);
                }}
                selectedDate={selectedDate}
                initialTable={quickTable}
                onSuccess={bookedDate => {
                    if (bookedDate && bookedDate !== selectedDate) {
                        setSelectedDate(bookedDate);
                    }
                }}
            />
        </div>
    );
};
