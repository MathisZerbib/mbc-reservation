import { useEffect, useState } from 'react';
import { api } from '../services/api';

export type UserRole = 'OWNER' | 'STAFF';

/** Current signed-in role (null while loading or signed out). Cached per session. */
let cached: { role: UserRole; email: string } | null | undefined;

/** Clear the cached role (call on logout). */
export function clearUserRole(): void {
    cached = undefined;
}

export function useUserRole(): { role: UserRole | null; email: string | null; loading: boolean } {
    const [token] = useState(() => localStorage.getItem('token'));
    const [state, setState] = useState<{ role: UserRole | null; email: string | null }>(
        cached ?? { role: null, email: null },
    );
    // Loading only when a token exists but the role isn't resolved yet.
    const [loading, setLoading] = useState(cached === undefined && !!token);

    useEffect(() => {
        if (cached !== undefined || !token) return;
        let alive = true;
        api.getMe()
            .then(me => {
                cached = { role: me.role, email: me.email };
                if (alive) {
                    setState(cached);
                    setLoading(false);
                }
            })
            .catch(() => {
                cached = null;
                if (alive) setLoading(false);
            });
        return () => {
            alive = false;
        };
    }, [token]);

    return { ...state, loading };
}
