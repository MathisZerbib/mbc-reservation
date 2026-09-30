import { useCallback, useEffect, useState } from 'react';
import dayjs, { RESTAURANT_TZ } from '../utils/dayjs';

type DarkPref = 'auto' | 'on' | 'off';

const KEY = 'host-dark-mode';

/** Evening service window in restaurant time (18:00 → 07:00). */
const isEveningNow = (): boolean => {
    const h = dayjs().tz(RESTAURANT_TZ).hour();
    return h >= 18 || h < 7;
};

/**
 * Host dark mode: automatic during the evening service, manually
 * overridable (persisted). Toggles the `.dark` class consumed by the
 * Tailwind v4 dark variant on host surfaces.
 */
export function useDarkMode() {
    const [pref, setPref] = useState<DarkPref>(() => {
        try {
            const saved = localStorage.getItem(KEY);
            if (saved === 'on' || saved === 'off' || saved === 'auto') return saved;
        } catch {
            // Private mode — fall back to auto.
        }
        return 'auto';
    });
    const [dark, setDark] = useState(false);

    useEffect(() => {
        const apply = () => {
            const on = pref === 'on' || (pref === 'auto' && isEveningNow());
            setDark(on);
            document.documentElement.classList.toggle('dark', on);
        };
        apply();
        const id = window.setInterval(apply, 60_000);
        return () => window.clearInterval(id);
    }, [pref]);

    const cycle = useCallback(() => {
        setPref(prev => {
            const next: DarkPref = prev === 'auto' ? 'on' : prev === 'on' ? 'off' : 'auto';
            try {
                localStorage.setItem(KEY, next);
            } catch {
                // Private mode — preference simply won't persist.
            }
            return next;
        });
    }, []);

    return { dark, pref, cycle };
}
