import { useEffect } from 'react';

interface HostShortcutActions {
    /** N / R — open the quick-résa modal. */
    onQuickRes?: () => void;
    /** Esc — close the topmost layer (modal, sheet, placement). */
    onEscape?: () => void;
}

/**
 * Host keyboard shortcuts. `/` is owned by the command bar itself.
 * Typing contexts are respected (except Esc, which always unwinds).
 */
export function useHostShortcuts({ onQuickRes, onEscape }: HostShortcutActions) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onEscape?.();
                return;
            }
            const el = e.target as HTMLElement | null;
            const typing =
                !!el &&
                (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
            if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
            const k = e.key.toLowerCase();
            if (k === 'n' || k === 'r') {
                e.preventDefault();
                onQuickRes?.();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onQuickRes, onEscape]);
}
