import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';

import { requireRole } from './isAuthenticated';
import { prisma } from '../lib/prisma';

vi.mock('../lib/prisma', () => ({
    prisma: { user: { findUnique: vi.fn() } },
}));

const findUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;

const run = async (role: string | null, gate: 'OWNER' | 'STAFF' = 'OWNER') => {
    const statuses: number[] = [];
    const req = { payload: { userId: role ? 'u1' : undefined } } as any;
    const res = { status: (s: number) => { statuses.push(s); return { json: () => undefined }; } } as unknown as Response;
    let next = false;
    if (role) findUnique.mockResolvedValue({ role } as any);
    await requireRole(gate)(req, res, () => { next = true; });
    return { statuses, next };
};

describe('requireRole', () => {
    beforeEach(() => vi.clearAllMocks());

    it('lets owners through the owner gate', async () => {
        expect(await run('OWNER')).toEqual({ statuses: [], next: true });
    });

    it('blocks staff at the owner gate with 403', async () => {
        expect(await run('STAFF')).toEqual({ statuses: [403], next: false });
    });

    it('rejects missing users with 401', async () => {
        expect(await run(null)).toEqual({ statuses: [401], next: false });
    });
});
