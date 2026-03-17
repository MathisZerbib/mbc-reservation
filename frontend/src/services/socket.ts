import { io } from 'socket.io-client';

const apiUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

// Create a single socket instance
export const socket = io(apiUrl, {
    autoConnect: false,
});
