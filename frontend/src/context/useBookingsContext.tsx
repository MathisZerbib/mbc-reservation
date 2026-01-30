import { useContext } from 'react';
import { BookingsContext } from './BookingsContext';

export const useBookingsContext = () => {
  const ctx = useContext(BookingsContext);
  if (!ctx) throw new Error('useBookingsContext must be used within a BookingsProvider');
  return ctx;
};