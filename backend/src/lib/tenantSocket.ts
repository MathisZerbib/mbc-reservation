import type { Server } from 'socket.io';

/**
 * Tenant-scoped realtime: every socket joins `tenant:<id>` after the
 * handshake JWT is verified (see server.ts). All emits MUST go through
 * emitToTenant — a bare io.emit would leak one restaurant's bookings
 * (names, phones, emails) to every other connected tenant.
 */
export const tenantRoom = (tenantId: string): string => `tenant:${tenantId}`;

export function emitToTenant(io: Server, tenantId: string, event: string, payload: unknown): void {
    io.to(tenantRoom(tenantId)).emit(event, payload);
}
