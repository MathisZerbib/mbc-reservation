import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import dayjs, { RESTAURANT_TZ } from '../utils/dayjs';
import { FloorPlan } from './FloorPlan';
import { Agenda } from './Agenda';
import { ServiceMetrics } from './ServiceMetrics';
import { HostSearchBar } from './HostSearchBar';
import { HostHeader } from './HostHeader';
import { AdminQuickReservation } from './AdminQuickReservation';
import { TrialBanner } from './TrialBanner';
import { useBookingsContext } from '../context/useBookingsContext';
import { useDarkMode } from '../hooks/useDarkMode';
import { useHostShortcuts } from '../hooks/useHostShortcuts';
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
    const [split, setSplit] = useState(true);
    const [dragOverTableId, setDragOverTableId] = useState<string | null>(null);
    const dragOverRef = useRef<string | null>(null);
    const { bookings, refresh } = useBookingsContext();
    const { dark, pref, cycle } = useDarkMode();

    useHostShortcuts({
        onQuickRes: () => setIsQuickResOpen(true),
        onEscape: () => {
            if (isQuickResOpen) {
                setIsQuickResOpen(false);
                setQuickTable(null);
            } else if (selectedTableId) {
                setSelectedTableId(null);
            } else if (placementBookingId) {
                setPlacementBookingId(null);
            }
        },
    });

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

    const handleAssignDrop = async (bookingId: string, tableId: string) => {
        try {
            await api.updateAssignment(bookingId, [tableId]);
            await refresh();
        } catch (e) {
            console.error('Drag-and-drop assign failed', e);
        } finally {
            dragOverRef.current = null;
            setDragOverTableId(null);
        }
    };

    const handleDragOverTable = (tableId: string | null) => {
        if (dragOverRef.current === tableId) return;
        dragOverRef.current = tableId;
        setDragOverTableId(tableId);
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-3 lg:p-4 h-screen overflow-hidden flex flex-col">
            <div className="max-w-[1600px] mx-auto w-full flex flex-col h-full gap-4">
                <HostHeader date={selectedDate} arrivalsNow={arrivalsNow} onQuickRes={() => setIsQuickResOpen(true)} darkPref={pref} dark={dark} onToggleDark={cycle} />
                <TrialBanner />
                <div className="flex-none">
                    <HostSearchBar
                        value={hostQuery}
                        onChange={setHostQuery}
                        matchCount={queryMatches.length}
                        onSubmit={handleSearchSubmit}
                    />
                </div>
                <ServiceMetrics bookings={bookings} date={selectedDate} />
                <div className="flex-1 min-h-[480px] flex flex-col xl:flex-row gap-4 min-h-0">
                    <div className="flex-1 min-h-[480px] overflow-hidden relative rounded-[2.5rem] bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200/60 dark:border-slate-700/60">
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
                        dragOverTableId={dragOverTableId}
                        splitActive={split}
                        onToggleSplit={() => setSplit(v => !v)}
                    />
                    </div>
                    {split && (
                        <div className="hidden xl:flex w-[400px] flex-none min-h-0">
                            <Agenda
                                setHoveredBookingId={setHoveredBookingId}
                                date={selectedDate}
                                setDate={setSelectedDate}
                                externalQuery={hostQuery}
                                selectedBookingId={placementBookingId}
                                onPlaceTables={setPlacementBookingId}
                                draggableRows
                                onDragOverTable={handleDragOverTable}
                                onAssignRowDrop={handleAssignDrop}
                            />
                        </div>
                    )}
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
