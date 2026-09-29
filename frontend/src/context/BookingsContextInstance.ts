import { createContext } from 'react';
import type { Booking } from '../types';

export interface BookingsContextType {
  bookings: Booking[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const BookingsContext = createContext<BookingsContextType | null>(null);
