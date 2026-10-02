import React, { useEffect, type ReactNode } from 'react';
import { connectSocket, disconnectSocket } from '../services/socket';
import { bindBookingsSocket } from './bookingsStore';
import { bindRestaurantSocket } from './restaurantStore';

/**
 * Realtime bridge for the authenticated area: opens the socket and wires the
 * store handlers exactly once (StrictMode-safe), tears it down on unmount.
 * Data itself loads lazily, per page, through the store hooks.
 */
export const BookingsSync: React.FC<{ children: ReactNode }> = ({ children }) => {
  useEffect(() => {
    connectSocket();
    bindBookingsSocket();
    bindRestaurantSocket();
    return () => {
      disconnectSocket();
    };
  }, []);

  return <>{children}</>;
};