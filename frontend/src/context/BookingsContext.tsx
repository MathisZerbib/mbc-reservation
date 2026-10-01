import { type ReactNode, useEffect } from 'react';
import { useBookings } from '../hooks/useBookings';
import { connectSocket, disconnectSocket } from '../services/socket';
import { BookingsContext } from './BookingsContextInstance';

interface BookingsProviderProps {
  children: ReactNode;
}

export const BookingsProvider = ({ children }: BookingsProviderProps) => {
  const bookingsState = useBookings();

  useEffect(() => {
    connectSocket();
    return () => {
      disconnectSocket();
    };
  }, []);

  return (
    <BookingsContext.Provider value={bookingsState}>
      {children}
    </BookingsContext.Provider>
  );
};
