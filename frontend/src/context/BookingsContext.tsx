import { createContext, type ReactNode, useEffect } from 'react';
import { useBookings } from '../hooks/useBookings';
import { socket } from '../services/socket';
import type { Booking } from '../types';

interface BookingsContextType {
  bookings: Booking[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const BookingsContext = createContext<BookingsContextType | null>(null);

interface BookingsProviderProps {
  children: ReactNode;
}

export const BookingsProvider = ({ children }: BookingsProviderProps) => {
  const bookingsState = useBookings();

  useEffect(() => {
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <BookingsContext.Provider value={bookingsState}>
      {children}
    </BookingsContext.Provider>
  );
};
