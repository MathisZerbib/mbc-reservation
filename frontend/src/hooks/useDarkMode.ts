import { useCallback, useEffect, useState } from 'react';
import dayjs, { RESTAURANT_TZ } from '../utils/dayjs';

const KEY = 'host-dark-mode';

/** Evening service window in restaurant time (18:00 → 07:00). */
const isEveningNow = (): boolean => {
    const h = dayjs().tz(RESTAURANT_TZ).hour();
    return h >= 18 || h < 7;
};

/**
 * Host dark mode: on in the evening by default, one tap toggles
 * moon/sun (persisted). Toggles the `.dark` class consumed by the
 * Tailwind v4 dark variant on host surfaces.
 */
export function useDarkMode() {
    const [dark, setDark] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem(KEY);
            if (saved === 'on') return true;
            if (saved === 'off') return false;
        } catch {
            // Private mode — fall back to the evening default.
        }
        return isEveningNow();
    });

    useEffect(() => {
        document.documentElement.classList.toggle('dark', dark);
    }, [dark]);

    const toggle = useCallback(() => {
        setDark(prev => {
            const next = !prev;
            try {
                localStorage.setItem(KEY, next ? 'on' : 'off');
            } catch {
                // Private mode — preference simply won't persist.
            }
            return next;
        });
    }, []);

    return { dark, toggle };
}
