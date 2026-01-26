export type TableShape = 'RECTANGULAR' | 'OCTAGONAL' | 'CAPSULE' | 'ROUND' | 'BAR' | 'SQUARE';

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

// Coordinate system: 1000x800 canvas
export const FLOOR_PLAN_DATA: TableConfig[] = [
    // --- TOP ROW ---
    // 10 (Oct) - Left Top
    { id: '10', x: 50, y: 50, width: 80, height: 80, shape: 'OCTAGONAL' },
    // 9 (Rect)
    { id: '9', x: 150, y: 50, width: 60, height: 80, shape: 'RECTANGULAR' },
    // 8
    { id: '8', x: 220, y: 50, width: 60, height: 80, shape: 'RECTANGULAR' },
    // 7
    { id: '7', x: 290, y: 50, width: 60, height: 80, shape: 'RECTANGULAR' },
    // 6
    { id: '6', x: 360, y: 50, width: 60, height: 80, shape: 'RECTANGULAR' },
    // 5
    { id: '5', x: 450, y: 50, width: 60, height: 80, shape: 'RECTANGULAR' }, // Gap for fold?
    // 4
    { id: '4', x: 520, y: 50, width: 80, height: 80, shape: 'RECTANGULAR' }, // Looks bigger
    // 3
    { id: '3', x: 610, y: 50, width: 60, height: 80, shape: 'RECTANGULAR' },
    // 2
    { id: '2', x: 680, y: 50, width: 80, height: 80, shape: 'RECTANGULAR' },
    // 1 (Oct) - Right Top
    { id: '1', x: 770, y: 50, width: 80, height: 80, shape: 'OCTAGONAL' },

    // --- LEFT COLUMN (100-105) ---
    { id: '105', x: 20, y: 150, width: 50, height: 50, shape: 'OCTAGONAL' },
    { id: '104', x: 20, y: 210, width: 50, height: 50, shape: 'OCTAGONAL' },
    { id: '103', x: 20, y: 270, width: 50, height: 50, shape: 'OCTAGONAL' },
    { id: '102', x: 20, y: 330, width: 50, height: 50, shape: 'OCTAGONAL' },
    { id: '101', x: 20, y: 390, width: 50, height: 50, shape: 'OCTAGONAL' },
    { id: '100', x: 20, y: 450, width: 50, height: 50, shape: 'OCTAGONAL' },


    // --- MIDDLE AREA (11, 12, 50-54) ---
    // 54 (Angled/Small)
    // { id: '54', x: 180, y: 150, width: 40, height: 60, shape: 'RECTANGULAR', rotation: 45 },

    // 53, 52 - Above 11/12?
    { id: '53', x: 110, y: 200, width: 40, height: 40, shape: 'SQUARE' },
    { id: '52', x: 110, y: 260, width: 40, height: 40, shape: 'SQUARE' },
    // 51, 50
    { id: '51', x: 110, y: 320, width: 40, height: 40, shape: 'SQUARE' },
    { id: '50', x: 110, y: 380, width: 40, height: 40, shape: 'SQUARE' },

    // 11 (Large)
    { id: '11', x: 170, y: 200, width: 100, height: 120, shape: 'RECTANGULAR' },

    // 12 (Large)
    { id: '12', x: 170, y: 350, width: 100, height: 120, shape: 'RECTANGULAR' },

    // --- LEFT INNER STACK (13, 14, 15) ---
    { id: '13', x: 150, y: 500, width: 40, height: 40, shape: 'ROUND' },
    { id: '14', x: 200, y: 500, width: 40, height: 40, shape: 'ROUND' },
    { id: '15', x: 250, y: 500, width: 40, height: 40, shape: 'ROUND' },


    // 16, 17, 18, 19 - Below 12/11? Or beside?
    { id: '16', x: 300, y: 420, width: 40, height: 40, shape: 'ROUND' },
    { id: '17', x: 300, y: 360, width: 40, height: 40, shape: 'ROUND' },
    { id: '18', x: 300, y: 300, width: 40, height: 40, shape: 'ROUND' },
    { id: '19', x: 300, y: 240, width: 40, height: 40, shape: 'ROUND' },

    // --- CAPSULE BOOTHS (20-36) ---
    // Top row
    { id: '22', x: 400, y: 200, width: 120, height: 60, shape: 'CAPSULE' },
    { id: '21', x: 400, y: 270, width: 120, height: 60, shape: 'CAPSULE' },
    { id: '25', x: 530, y: 200, width: 120, height: 60, shape: 'CAPSULE' },
    { id: '24', x: 530, y: 270, width: 120, height: 60, shape: 'CAPSULE' },
    { id: '28', x: 660, y: 200, width: 120, height: 60, shape: 'CAPSULE' },

    // Bottom row
    { id: '20', x: 400, y: 340, width: 120, height: 60, shape: 'CAPSULE' },
    { id: '23', x: 530, y: 340, width: 120, height: 60, shape: 'CAPSULE' },
    { id: '26', x: 660, y: 340, width: 120, height: 60, shape: 'CAPSULE' },
    { id: '27', x: 660, y: 270, width: 120, height: 60, shape: 'CAPSULE' },

    // 29
    { id: '29', x: 800, y: 270, width: 80, height: 80, shape: 'RECTANGULAR' },

    // 30-36 Bottom area
    { id: '36', x: 360, y: 600, width: 40, height: 40, shape: 'ROUND' },
    { id: '35', x: 300, y: 600, width: 40, height: 40, shape: 'ROUND' },
    { id: '34', x: 240, y: 600, width: 40, height: 40, shape: 'ROUND' },
    { id: '33', x: 180, y: 600, width: 40, height: 40, shape: 'ROUND' },
    { id: '32', x: 120, y: 600, width: 40, height: 40, shape: 'ROUND' },
    { id: '31', x: 60, y: 600, width: 40, height: 40, shape: 'ROUND' },
    { id: '30', x: 0, y: 600, width: 40, height: 40, shape: 'ROUND' },

    // Bar stools
    { id: '40', x: 450, y: 600, width: 30, height: 30, shape: 'BAR' },
    { id: '42', x: 500, y: 600, width: 30, height: 30, shape: 'BAR' },
    { id: '44', x: 550, y: 600, width: 30, height: 30, shape: 'BAR' },
    { id: '46', x: 600, y: 600, width: 30, height: 30, shape: 'BAR' },
    { id: '48', x: 650, y: 600, width: 30, height: 30, shape: 'BAR' },
];
