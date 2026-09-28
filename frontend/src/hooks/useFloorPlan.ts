import { useCallback, useEffect, useState } from 'react';
import { api, fileUrl } from '../services/api';
import { socket } from '../services/socket';
import { FLOOR_PLAN_DATA, type TableConfig } from '../utils/floorPlanData';
import type { LayoutTable, RestaurantSettings } from '../types/index';

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

/** Tenant settings with live refresh on `settings-update`. */
export function useRestaurantSettings() {
    const [settings, setSettings] = useState<RestaurantSettings | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            setSettings(await api.getSettings());
        } catch (e) {
            console.error('Failed to fetch settings', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
        socket.on('settings-update', refresh);
        return () => {
            socket.off('settings-update', refresh);
        };
    }, [refresh]);

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
 * Floor-plan tables from the DB with live refresh on `floor-plan-update`.
 * Falls back to the shipped constants when the backend is unreachable or
 * no layout has been saved yet, so the map never renders blank.
 */
export function useLayoutTables(): LayoutState {
    const [raw, setRaw] = useState<LayoutTable[] | null>(null);
    const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const [layout, settings] = await Promise.all([
                api.getLayout(),
                api.getSettings().catch(() => null),
            ]);
            if (layout.length > 0) setRaw(layout);
            setBackgroundUrl(fileUrl(settings?.floorPlanImageUrl ?? null));
        } catch (e) {
            console.error('Failed to fetch layout', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
        socket.on('floor-plan-update', refresh);
        socket.on('settings-update', refresh);
        return () => {
            socket.off('floor-plan-update', refresh);
            socket.off('settings-update', refresh);
        };
    }, [refresh]);

    return {
        tables: raw ? raw.map(toTableConfig) : FLOOR_PLAN_DATA,
        raw: raw ?? [],
        backgroundUrl,
        loading,
        refresh,
    };
}
