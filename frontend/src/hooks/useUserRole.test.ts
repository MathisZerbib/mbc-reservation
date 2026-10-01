import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { api } from '../services/api';
import { useUserRole, clearUserRole } from './useUserRole';

vi.mock('../services/api', () => ({
    api: { getMe: vi.fn() },
}));

const getMe = api.getMe as unknown as ReturnType<typeof vi.fn>;

describe('useUserRole', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        clearUserRole();
    });

    it('returns null role without a token (signed out)', () => {
        const { result } = renderHook(() => useUserRole());
        expect(result.current).toEqual({ role: null, email: null, loading: false });
        expect(getMe).not.toHaveBeenCalled();
    });

    it('resolves the owner role from /auth/me', async () => {
        localStorage.setItem('token', 'jwt');
        getMe.mockResolvedValue({ id: '1', email: 'a@b.c', role: 'OWNER', tenantId: 't1' });
        const { result } = renderHook(() => useUserRole());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.role).toBe('OWNER');
    });
});
