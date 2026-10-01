import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const apiUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

// Single socket instance. Auth token is (re)sent on every handshake —
// including automatic reconnects — so the server can join the tenant room.
export const socket = io(apiUrl, {
    autoConnect: false,
});

/** Connect with the current JWT (host pages). Public widget connects roomless. */
export function connectSocket(): void {
    socket.auth = { token: localStorage.getItem('token') ?? undefined };
    if (!socket.connected) socket.connect();
}

export function disconnectSocket(): void {
    socket.disconnect();
}

/** Live connection flag for a discreet realtime indicator. */
export function useSocketStatus(): boolean {
    const [online, setOnline] = useState(socket.connected);
    useEffect(() => {
        const on = () => setOnline(true);
        const off = () => setOnline(false);
        socket.on('connect', on);
        socket.on('disconnect', off);
        return () => {
            socket.off('connect', on);
            socket.off('disconnect', off);
        };
    }, []);
    return online;
}
