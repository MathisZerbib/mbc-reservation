import { createContext, type ReactNode } from 'react';
import { useBookings } from '../hooks/useBookings';
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
  return (
    <BookingsContext.Provider value={bookingsState}>
      {children}
    </BookingsContext.Provider>
  );
};


