import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs, { RESTAURANT_TZ } from '../utils/dayjs';
import { Agenda } from './Agenda';
import { ReconciliationView } from './ReconciliationView';
import { HostSearchBar } from './HostSearchBar';
import { AdminQuickReservation } from './AdminQuickReservation';
import { useBookingsForDate } from '../hooks/useBookings';
import { useUiStore } from '../stores/uiStore';
import { useHostShortcuts } from '../hooks/useHostShortcuts';
import { matchesHostQuery, countArrivalsNow } from '../utils/bookingUtils';

/**
 * Host planning workspace: full-width arrivals list. Seating happens on
 * the live map — Placer deep-links there via ?place=<bookingId>.
 */
export const PlanningPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedDate, setSelectedDate] = useState(
        searchParams.get('date') || dayjs.tz(undefined, RESTAURANT_TZ).format('YYYY-MM-DD'),
    );
    const [hostQuery, setHostQuery] = useState('');
    const [, setHoveredBookingId] = useState<string | null>(null);
    const [isQuickResOpen, setIsQuickResOpen] = useState(false);
    const bookings = useBookingsForDate(selectedDate);
    const setHeaderConfig = useUiStore((s) => s.setHeader);
    const openQuickRes = useCallback(() => setIsQuickResOpen(true), []);

    useHostShortcuts({
        onQuickRes: () => setIsQuickResOpen(true),
        onEscape: () => {
            if (isQuickResOpen) setIsQuickResOpen(false);
        },
    });

    const dayBookings = bookings.filter(
        b => dayjs(b.startTime).tz(RESTAURANT_TZ).format('YYYY-MM-DD') === selectedDate && b.status !== 'CANCELLED',
    );
    const arrivalsNow = countArrivalsNow(bookings, selectedDate, dayjs());
    const queryMatches = hostQuery.trim() === '' ? [] : dayBookings.filter(b => matchesHostQuery(b, hostQuery));

    useEffect(() => {
        if (selectedDate) {
            setSearchParams({ date: selectedDate }, { replace: true });
        }
    }, [selectedDate, setSearchParams]);

    useEffect(() => {
        setHeaderConfig({ date: selectedDate, arrivalsNow, onQuickRes: openQuickRes });
    }, [selectedDate, arrivalsNow, openQuickRes, setHeaderConfig]);

    return (
        <div className="flex flex-col gap-4">
                <div className="flex-none">
                    <HostSearchBar
                        value={hostQuery}
                        onChange={setHostQuery}
                        matchCount={queryMatches.length}
                        onSubmit={() => {
                            if (queryMatches.length === 1) setHoveredBookingId(queryMatches[0].id);
                        }}
                    />
                </div>
                <div className="min-h-[60vh]">
                    <Agenda
                        setHoveredBookingId={setHoveredBookingId}
                        date={selectedDate}
                        setDate={setSelectedDate}
                        externalQuery={hostQuery}
                        onPlaceTables={id => navigate(`/app/live?date=${selectedDate}&place=${id}`)}
                    />
                </div>
                {/* Morning-after: unresolved HELD holds to release or charge. */}
                <ReconciliationView />

            <AdminQuickReservation
                isOpen={isQuickResOpen}
                onClose={() => setIsQuickResOpen(false)}
                selectedDate={selectedDate}
                onSuccess={bookedDate => {
                    if (bookedDate && bookedDate !== selectedDate) {
                        setSelectedDate(bookedDate);
                    }
                }}
            />
        </div>
    );
};
