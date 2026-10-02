import { create } from 'zustand';
import { api } from '../services/api';

export type UserRole = 'OWNER' | 'STAFF';

/**
 * Current signed-in user. Single-flight: several components calling
 * `useUserRole` share one `GET /auth/me` (previously a hand-rolled module
 * cache in the hook).
 */
interface UserState {
  role: UserRole | null;
  email: string | null;
  loading: boolean;
  loaded: boolean;
  fetchMe: () => Promise<void>;
  clear: () => void;
}

const hasToken = (): boolean => {
  try {
    return typeof window !== 'undefined' && !!window.localStorage.getItem('token');
  } catch {
    return false;
  }
};

let pendingMe: Promise<void> | null = null;

export const useUserStore = create<UserState>((set, get) => ({
  role: null,
  email: null,
  loading: false,
  loaded: false,

  fetchMe: () => {
    if (pendingMe) return pendingMe;
    if (get().loaded) return Promise.resolve();
    if (!hasToken()) {
      set({ loaded: true, loading: false });
      return Promise.resolve();
    }
    set({ loading: true });
    pendingMe = api
      .getMe()
      .then((me) => set({ role: me.role, email: me.email, loaded: true }))
      .catch(() => set({ loaded: true }))
      .finally(() => {
        set({ loading: false });
        pendingMe = null;
      });
    return pendingMe;
  },

  clear: () => set({ role: null, email: null, loaded: false, loading: false }),
}));