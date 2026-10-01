import type { LayoutTable, LayoutTableType } from '../types/index';

export type TableShape = LayoutTableType;

/** Single canvas size shared by editor, viewer and backend validation. */
export const CANVAS_W = 1000;
export const CANVAS_H = 800;

export const TABLE_TYPES: LayoutTableType[] = ['RECTANGULAR', 'SQUARE', 'ROUND', 'OCTAGONAL', 'CAPSULE', 'BAR'];

export interface TableConfig {
    id: string; // "1", "10", "BAR-40"
    x: number;
    y: number;
    width: number;
    height: number;
    shape: TableShape;
    rotation?: number;
    seats?: number;
}

/** Shared SVG path renderer for table shapes (single source of truth). */
export const tableShapePath = (table: Pick<TableConfig, 'width' | 'height' | 'shape'>): string => {
    const { width, height, shape } = table;
    switch (shape) {
        case 'OCTAGONAL': {
            const corner = Math.min(width, height) * 0.3;
            return `M ${corner} 0 H ${width - corner} L ${width} ${corner} V ${height - corner} L ${width - corner} ${height} H ${corner} L 0 ${height - corner} V ${corner} Z`;
        }
        case 'ROUND':
            return `M ${width / 2}, 0 A ${width / 2} ${height / 2} 0 1,1 ${width / 2} ${height} A ${width / 2} ${height / 2} 0 1,1 ${width / 2} 0`;
        case 'CAPSULE': {
            const r = Math.min(width, height) / 2;
            if (width > height) {
                return `M ${r} 0 H ${width - r} A ${r} ${r} 0 0 1 ${width - r} ${height} H ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
            }
            return `M 0 ${r} V ${height - r} A ${r} ${r} 0 0 0 ${width} ${height - r} V ${r} A ${r} ${r} 0 0 0 0 ${r} Z`;
        }
        case 'BAR': {
            const r = Math.max(width, height) * 0.65;
            const cx = width / 2;
            const cy = height / 2;
            return `M ${cx}, ${cy - r} A ${r} ${r} 0 1,1 ${cx} ${cy + r} A ${r} ${r} 0 1,1 ${cx} ${cy - r}`;
        }
        case 'SQUARE':
            return `M 0 0 H ${width} V ${height} H 0 Z`;
        case 'RECTANGULAR':
        default:
            return `M 0 0 H ${width} V ${height} H 0 Z`;
    }
};

// Coordinate system: 1000x800 canvas
export const FLOOR_PLAN_DATA: TableConfig[] = [
    // Top row
    { id: '10', x: 50, y: 50, width: 80, height: 80, shape: 'OCTAGONAL' },
    { id: '9', x: 150, y: 50, width: 60, height: 80, shape: 'RECTANGULAR' },
    { id: '8', x: 220, y: 50, width: 60, height: 80, shape: 'RECTANGULAR' },
    { id: '7', x: 290, y: 50, width: 80, height: 80, shape: 'RECTANGULAR' },
    { id: '6', x: 380, y: 50, width: 60, height: 80, shape: 'RECTANGULAR' },
    { id: '5', x: 450, y: 50, width: 60, height: 80, shape: 'RECTANGULAR' },
    { id: '4', x: 520, y: 50, width: 80, height: 80, shape: 'RECTANGULAR' },
    { id: '3', x: 610, y: 50, width: 60, height: 80, shape: 'RECTANGULAR' },
    { id: '2', x: 680, y: 50, width: 80, height: 80, shape: 'RECTANGULAR' },
    { id: '1', x: 770, y: 50, width: 80, height: 80, shape: 'OCTAGONAL' },

    // Middle area
    { id: '53', x: 110, y: 200, width: 40, height: 40, shape: 'SQUARE' },
    { id: '52', x: 110, y: 260, width: 40, height: 40, shape: 'SQUARE' },
    { id: '51', x: 110, y: 320, width: 40, height: 40, shape: 'SQUARE' },
    { id: '50', x: 110, y: 380, width: 40, height: 40, shape: 'SQUARE' },
    { id: '11', x: 170, y: 200, width: 100, height: 120, shape: 'RECTANGULAR' },
    { id: '12', x: 170, y: 350, width: 100, height: 120, shape: 'RECTANGULAR' },

    // Left inner stack
    { id: '13', x: 150, y: 500, width: 40, height: 40, shape: 'ROUND' },
    { id: '14', x: 200, y: 500, width: 40, height: 40, shape: 'ROUND' },
    { id: '15', x: 250, y: 500, width: 40, height: 40, shape: 'ROUND' },
    { id: '16', x: 300, y: 420, width: 40, height: 40, shape: 'ROUND' },
    { id: '17', x: 300, y: 360, width: 40, height: 40, shape: 'ROUND' },
    { id: '18', x: 300, y: 300, width: 40, height: 40, shape: 'ROUND' },
    { id: '19', x: 300, y: 240, width: 40, height: 40, shape: 'ROUND' },

    // Capsule booths
    { id: '20', x: 400, y: 340, width: 120, height: 60, shape: 'CAPSULE' },
    { id: '21', x: 400, y: 270, width: 120, height: 60, shape: 'CAPSULE' },
    { id: '22', x: 400, y: 200, width: 120, height: 60, shape: 'CAPSULE' },
    { id: '23', x: 530, y: 340, width: 120, height: 60, shape: 'CAPSULE' },
    { id: '24', x: 530, y: 270, width: 120, height: 60, shape: 'CAPSULE' },
    { id: '25', x: 530, y: 200, width: 120, height: 60, shape: 'CAPSULE' },
    { id: '26', x: 660, y: 340, width: 120, height: 60, shape: 'CAPSULE' },
    { id: '27', x: 660, y: 270, width: 120, height: 60, shape: 'CAPSULE' },
    { id: '28', x: 660, y: 200, width: 120, height: 60, shape: 'CAPSULE' },
    { id: '29', x: 800, y: 270, width: 80, height: 80, shape: 'RECTANGULAR' },

    // Bottom area
    { id: '36', x: 360, y: 600, width: 40, height: 40, shape: 'ROUND' },
    { id: '35', x: 300, y: 600, width: 40, height: 40, shape: 'ROUND' },
    { id: '34', x: 240, y: 600, width: 40, height: 40, shape: 'ROUND' },
    { id: '33', x: 180, y: 600, width: 40, height: 40, shape: 'ROUND' },
    { id: '32', x: 120, y: 600, width: 40, height: 40, shape: 'ROUND' },
    { id: '31', x: 60, y: 600, width: 40, height: 40, shape: 'ROUND' },
    { id: '30', x: 0, y: 600, width: 40, height: 40, shape: 'ROUND' },
];

/** Working copy of the shipped constants so a first save persists them. */
export const presetFromConstants = (): LayoutTable[] =>
    FLOOR_PLAN_DATA.map((t, i) => ({
        id: 10_000 + i,
        name: t.id,
        capacity: t.seats ?? 2,
        type: t.shape,
        x: t.x,
        y: t.y,
        width: t.width,
        height: t.height,
        rotation: t.rotation ?? 0,
        adjacentNames: [],
    }));

/** Grid of 2-top tables for the quick presets (no ids — newcomers). */
export const presetGrid = (count: number): Array<Omit<LayoutTable, 'id'>> => {
    const cols = 8;
    return Array.from({ length: count }, (_, i) => ({
        name: String(i + 1),
        capacity: 2,
        type: 'RECTANGULAR' as const,
        x: 50 + (i % cols) * 110,
        y: 80 + Math.floor(i / cols) * 130,
        width: 60,
        height: 80,
        rotation: 0,
        adjacentNames: [],
    }));
};
