import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSocket = vi.hoisted(() => ({
    connected: false,
    auth: {},
    connect: vi.fn(),
    disconnect: vi.fn(),
}));

vi.mock('socket.io-client', () => ({
    io: vi.fn(() => mockSocket),
}));

import { connectSocket, disconnectSocket } from './socket';

describe('socket helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSocket.connected = false;
        localStorage.clear();
    });

    it('connects with the stored JWT for the tenant room handshake', () => {
        localStorage.setItem('token', 'jwt-token');
        connectSocket();
        expect(mockSocket.auth).toEqual({ token: 'jwt-token' });
        expect(mockSocket.connect).toHaveBeenCalled();
    });

    it('skips connect when already connected', () => {
        mockSocket.connected = true;
        connectSocket();
        expect(mockSocket.connect).not.toHaveBeenCalled();
    });

    it('disconnects', () => {
        disconnectSocket();
        expect(mockSocket.disconnect).toHaveBeenCalled();
    });
});
