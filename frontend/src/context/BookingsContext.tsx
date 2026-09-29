import { type ReactNode, useEffect } from 'react';
import { useBookings } from '../hooks/useBookings';
import { socket } from '../services/socket';
import { BookingsContext } from './BookingsContextInstance';

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
