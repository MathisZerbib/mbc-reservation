import { useEffect } from 'react';
import { useUserStore, type UserRole } from '../stores/userStore';

export type { UserRole };

const hasToken = (): boolean => {
    try {
        return typeof window !== 'undefined' && !!window.localStorage.getItem('token');
    } catch {
        return false;
    }
};

/** Clear the cached role (call on logout). */
export function clearUserRole(): void {
    useUserStore.getState().clear();
}

/**
 * Current signed-in role (null while loading or signed out). Backed by the
 * shared user store, so N components share a single `GET /auth/me`.
 */
export function useUserRole(): { role: UserRole | null; email: string | null; loading: boolean } {
    useEffect(() => {
        void useUserStore.getState().fetchMe();
    }, []);

    const role = useUserStore((s) => s.role);
    const email = useUserStore((s) => s.email);
    const loading = useUserStore((s) => s.loading || (!s.loaded && hasToken()));

    return { role, email, loading };
}
