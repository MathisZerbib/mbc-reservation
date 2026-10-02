import { useUiStore } from '../stores/uiStore';

/**
 * Host dark mode: on in the evening by default, one tap toggles moon/sun
 * (persisted). State lives in the shared UI store so every consumer agrees;
 * the `.dark` class is synced globally by the store (no effect here).
 */
export function useDarkMode() {
    const dark = useUiStore((s) => s.dark);
    const toggle = useUiStore((s) => s.toggleDark);
    return { dark, toggle };
}
