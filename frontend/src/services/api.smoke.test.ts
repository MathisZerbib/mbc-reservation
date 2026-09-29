import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from './api';

const calls: { url: string; init: RequestInit }[] = [];

describe('api client smoke', () => {
    beforeEach(() => {
        calls.length = 0;
        localStorage.clear();
        globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
            calls.push({ url: String(url), init: init ?? {} });
            return { ok: true, json: async () => ({}) } as Response;
        });
    });

    it('builds query URLs and sends the bearer token when auth is required', async () => {
        localStorage.setItem('token', 'tok-123');
        await api.getAnalytics('2026-09-29');
        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe('http://localhost:3000/api/analytics?date=2026-09-29');
        expect((calls[0].init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok-123');
    });

    it('posts JSON bodies without auth when not required', async () => {
        await api.register('a@b.c', 'supersecurepassword123', 'Bistro', 'token-xyz');
        expect(calls[0].url).toBe('http://localhost:3000/api/auth/register');
        const body = JSON.parse(calls[0].init.body as string);
        expect(body).toMatchObject({ email: 'a@b.c', restaurantName: 'Bistro', turnstileToken: 'token-xyz' });
        expect(calls[0].init.headers).not.toHaveProperty('Authorization');
    });

    it('scopes public reads by restaurant slug', async () => {
        await api.getDailyAvailability('2026-09-29', 2, 'mbc');
        expect(calls[0].url).toContain('slug=mbc');
        await api.getLayout('chez-luc');
        expect(calls[1].url).toBe('http://localhost:3000/api/tables?slug=chez-luc');
    });

    it('surfaces backend error messages', async () => {
        globalThis.fetch = vi.fn(async () => ({
            ok: false,
            json: async () => ({ error: 'Trial expired. Please subscribe to continue.' }),
        })) as unknown as typeof fetch;
        await expect(api.getTenant()).rejects.toThrow('Trial expired. Please subscribe to continue.');
    });
});
