import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
    prisma: { booking: { findMany: vi.fn() } },
}));

import { prisma } from '../lib/prisma';
import { bookingController } from './bookingController';

const findMany = prisma.booking.findMany as unknown as ReturnType<typeof vi.fn>;

const mockRes = () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    return { status, json };
};

const controller = bookingController({} as never);

describe('bookingController.getAllBookings', () => {
    beforeEach(() => vi.clearAllMocks());

    it('scopes to the requested restaurant-day when ?date is given', async () => {
        findMany.mockResolvedValue([]);
        const response = mockRes();

        await controller.getAllBookings(
            { query: { date: '2026-10-02' }, tenant: { id: 't1' } } as never,
            response as never,
        );

        const where = findMany.mock.calls[0][0].where;
        expect(where.tenantId).toBe('t1');
        // Europe/Paris day boundaries (CEST = UTC+2 in October).
        expect((where.startTime.gte as Date).toISOString()).toBe('2026-10-01T22:00:00.000Z');
        expect(response.json).toHaveBeenCalledWith([]);
    });

    it('returns the full history when no date is given', async () => {
        findMany.mockResolvedValue([]);

        await controller.getAllBookings(
            { query: {}, tenant: { id: 't1' } } as never,
            mockRes() as never,
        );

        expect(findMany.mock.calls[0][0].where.startTime).toBeUndefined();
    });

    it('rejects an invalid date', async () => {
        const response = mockRes();

        await controller.getAllBookings(
            { query: { date: 'nope' }, tenant: { id: 't1' } } as never,
            response as never,
        );

        expect(response.status).toHaveBeenCalledWith(400);
        expect(findMany).not.toHaveBeenCalled();
    });
});