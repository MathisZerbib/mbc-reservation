import { useCallback, useEffect } from 'react';
import { fileUrl } from '../services/api';
import { useRestaurantStore } from '../stores/restaurantStore';
import { FLOOR_PLAN_DATA, type TableConfig } from '../utils/floorPlanData';
import type { LayoutTable } from '../types/index';

/** DB layout row → renderer config (table names are the stable ids). */
export const toTableConfig = (t: LayoutTable): TableConfig => ({
    id: t.name,
    x: t.x ?? 0,
    y: t.y ?? 0,
    width: t.width,
    height: t.height,
    shape: t.type,
    rotation: t.rotation,
    seats: t.capacity,
});

/** Loads tenant + settings + layout once, deduped across every consumer. */
function useEnsureRestaurant() {
    useEffect(() => {
        void useRestaurantStore.getState().ensure();
    }, []);
}

/** Authenticated tenant context (slug, trial status), shared + live. */
export function useTenant() {
    useEnsureRestaurant();
    const tenant = useRestaurantStore((s) => s.tenant);
    const refresh = useCallback(() => useRestaurantStore.getState().loadTenant(true), []);
    return { tenant, refresh };
}

/** Tenant settings, shared across pages + live (`settings-update`). */
export function useRestaurantSettings() {
    useEnsureRestaurant();
    const settings = useRestaurantStore((s) => s.settings);
    const loading = useRestaurantStore((s) => s.loadingSettings);
    const refresh = useCallback(() => useRestaurantStore.getState().loadSettings(true), []);
    return { settings, loading, refresh, backgroundUrl: fileUrl(settings?.floorPlanImageUrl ?? null) };
}

interface LayoutState {
    tables: TableConfig[];
    raw: LayoutTable[];
    backgroundUrl: string | null;
    loading: boolean;
    refresh: () => Promise<void>;
}

/**
 * Floor-plan tables from the DB, shared + live (`floor-plan-update`).
 * Falls back to the shipped constants when the backend is unreachable or
 * no layout has been saved yet, so the map never renders blank.
 */
export function useLayoutTables(): LayoutState {
    useEnsureRestaurant();
    const raw = useRestaurantStore((s) => s.layout);
    const settings = useRestaurantStore((s) => s.settings);
    const loading = useRestaurantStore((s) => s.loadingLayout);
    const refresh = useCallback(() => useRestaurantStore.getState().loadLayout(true), []);

    return {
        tables: raw ? raw.map(toTableConfig) : FLOOR_PLAN_DATA,
        raw: raw ?? [],
        backgroundUrl: fileUrl(settings?.floorPlanImageUrl ?? null),
        loading,
        refresh,
    };
}
