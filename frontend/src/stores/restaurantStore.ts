import { create } from 'zustand';
import { api } from '../services/api';
import { socket } from '../services/socket';
import type { LayoutTable, RestaurantSettings, TenantContext } from '../types';

/**
 * Tenant / settings / floor-plan layout in one store.
 *
 * These three are always needed together and refreshed by the same socket
 * events. Previously each consumer held its own hook state, so the host page
 * fetched them once per component (6× `GET /settings`, 3 handlers per event).
 * A shared store with single-flight loading collapses that to one request and
 * one handler per resource.
 */

interface RestaurantState {
  tenant: TenantContext | null;
  settings: RestaurantSettings | null;
  layout: LayoutTable[] | null;
  loadingTenant: boolean;
  loadingSettings: boolean;
  loadingLayout: boolean;

  /** Load whatever is missing (deduped). Runs tenant + settings + layout. */
  ensure: () => Promise<void>;
  loadTenant: (force?: boolean) => Promise<void>;
  loadSettings: (force?: boolean) => Promise<void>;
  loadLayout: (force?: boolean) => Promise<void>;
}

const inflight = new Map<string, Promise<void>>();
const loaded = new Set<string>();

/** Single-flight: concurrent callers share one in-flight request. */
const runOnce = (key: string, run: () => Promise<void>): Promise<void> => {
  const existing = inflight.get(key);
  if (existing) return existing;
  const request = run().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, request);
  return request;
};

export const useRestaurantStore = create<RestaurantState>((set, get) => ({
  tenant: null,
  settings: null,
  layout: null,
  loadingTenant: false,
  loadingSettings: true,
  loadingLayout: true,

  ensure: async () => {
    await Promise.all([get().loadTenant(), get().loadSettings(), get().loadLayout()]);
  },

  loadTenant: (force = false) => {
    if (!force && loaded.has('tenant')) return Promise.resolve();
    return runOnce('tenant', async () => {
      set({ loadingTenant: true });
      try {
        set({ tenant: await api.getTenant() });
        loaded.add('tenant');
      } catch (e) {
        console.error('Failed to fetch tenant', e);
      } finally {
        set({ loadingTenant: false });
      }
    });
  },

  loadSettings: (force = false) => {
    if (!force && loaded.has('settings')) {
      if (get().loadingSettings) set({ loadingSettings: false });
      return Promise.resolve();
    }
    return runOnce('settings', async () => {
      set({ loadingSettings: true });
      try {
        set({ settings: await api.getSettings() });
        loaded.add('settings');
      } catch (e) {
        console.error('Failed to fetch settings', e);
      } finally {
        set({ loadingSettings: false });
      }
    });
  },

  loadLayout: (force = false) => {
    if (!force && loaded.has('layout')) {
      if (get().loadingLayout) set({ loadingLayout: false });
      return Promise.resolve();
    }
    return runOnce('layout', async () => {
      set({ loadingLayout: true });
      try {
        let slug = get().tenant?.slug;
        if (!slug) {
          await get().loadTenant();
          slug = get().tenant?.slug;
        }
        if (!slug) return;
        const layout = await api.getLayout(slug);
        // Empty layout → keep null so the map falls back to shipped constants.
        set({ layout: layout.length > 0 ? layout : null });
        loaded.add('layout');
      } catch (e) {
        console.error('Failed to fetch layout', e);
      } finally {
        set({ loadingLayout: false });
      }
    });
  },
}));

/** Latest snapshot without subscribing (safe outside React). */
export const restaurantStore = () => useRestaurantStore.getState();

let socketBound = false;

/** Realtime refresh of settings/layout/tenant (registered once). */
export const bindRestaurantSocket = (): void => {
  if (socketBound) return;
  socketBound = true;
  const onSettings = () => {
    const s = restaurantStore();
    void s.loadTenant(true);
    void s.loadSettings(true);
    void s.loadLayout(true);
  };
  socket.on('settings-update', onSettings);
  socket.on('floor-plan-update', () => {
    void restaurantStore().loadLayout(true);
  });
};