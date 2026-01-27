import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import type { Booking } from '../types/index';
import { api } from '../services/api';

const socket = io('http://localhost:3000');

export const useBookings = () => {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchBookings = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.fetchBookings();
            const sorted = data.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
            setBookings(sorted);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBookings();

        const handleUpdate = () => {
            fetchBookings();
        };

        socket.on('booking-update', handleUpdate);
        return () => {
            socket.off('booking-update', handleUpdate);
        };
    }, [fetchBookings]);

    return { bookings, loading, error, refresh: fetchBookings };
};
