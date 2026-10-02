import { create } from 'zustand';
import dayjs, { RESTAURANT_TZ } from '../utils/dayjs';

const DARK_KEY = 'host-dark-mode';

/** Evening service window in restaurant time (18:00 → 07:00). */
const isEveningNow = (): boolean => {
  const h = dayjs().tz(RESTAURANT_TZ).hour();
  return h >= 18 || h < 7;
};

const readStoredDark = (): boolean | null => {
  try {
    const saved = localStorage.getItem(DARK_KEY);
    if (saved === 'on') return true;
    if (saved === 'off') return false;
  } catch {
    // Private mode — fall back to the evening default.
  }
  return null;
};

export interface HeaderConfig {
  date?: string;
  arrivalsNow?: number;
  onQuickRes?: () => void;
}

/**
 * Shared UI state: dark mode (one source so AppShell/FloorPlan never
 * disagree) and the single header config pushed by each page.
 */
interface UiState {
  dark: boolean;
  toggleDark: () => void;
  header: HeaderConfig;
  setHeader: (patch: HeaderConfig) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  dark: readStoredDark() ?? isEveningNow(),

  toggleDark: () => {
    const dark = !get().dark;
    try {
      localStorage.setItem(DARK_KEY, dark ? 'on' : 'off');
    } catch {
      // Private mode — preference simply won't persist.
    }
    set({ dark });
  },

  header: {},

  setHeader: (patch) =>
    set((s) => {
      const { date, arrivalsNow, onQuickRes } = patch;
      if (
        s.header.date === date &&
        s.header.arrivalsNow === arrivalsNow &&
        s.header.onQuickRes === onQuickRes
      ) {
        return s;
      }
      return { header: { ...s.header, ...patch } };
    }),
}));

// Keep the `.dark` class (Tailwind variant) in sync from one global place —
// no component effect needed.
if (typeof document !== 'undefined') {
  document.documentElement.classList.toggle('dark', useUiStore.getState().dark);
  useUiStore.subscribe((state, prev) => {
    if (state.dark !== prev.dark) {
      document.documentElement.classList.toggle('dark', state.dark);
    }
  });
}