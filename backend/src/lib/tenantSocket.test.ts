import { describe, it, expect, vi } from 'vitest';

import { tenantRoom, emitToTenant } from './tenantSocket';

describe('tenantSocket', () => {
    it('scopes rooms per tenant', () => {
        expect(tenantRoom('abc')).toBe('tenant:abc');
        expect(tenantRoom('abc')).not.toBe(tenantRoom('def'));
    });

    it('emits only into the tenant room', () => {
        const emit = vi.fn();
        const io = { to: vi.fn().mockReturnValue({ emit }) } as any;
        emitToTenant(io, 'abc', 'booking-update', { type: 'new' });
        expect(io.to).toHaveBeenCalledWith('tenant:abc');
        expect(emit).toHaveBeenCalledWith('booking-update', { type: 'new' });
    });
});
