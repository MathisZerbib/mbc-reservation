export type TableShape = 'RECTANGULAR' | 'OCTAGONAL' | 'CAPSULE' | 'ROUND' | 'BAR' | 'SQUARE';

export interface TableConfig {
    id: string; 
    x: number;
    y: number;
    width: number;
    height: number;
    shape: TableShape;
    rotation?: number;
    seats?: number;
}

// Helper to determine capacity if not explicitly set
export const getCapacity = (table: TableConfig): number => {
    if (table.seats) return table.seats;
    
    // Default capacities based on shape/size logic
    switch (table.shape) {
        case 'BAR': return 1;
        case 'CAPSULE': return 2; // As per your logic "6 tables = 12 people"
        case 'OCTAGONAL': return 6; // Tables 1 & 10 are big
        case 'ROUND': return 2; // Small round tables
        case 'SQUARE': return 2;
        case 'RECTANGULAR':
            // Logic based on IDs from your previous checks
            if (['11', '12'].includes(table.id)) return 6;
            if (['2', '4', '7'].includes(table.id)) return 4; // "User wants 2,4,7 for group of 4"
            return 2; // Default small rect
        default: return 2;
    }
};

export const FLOOR_PLAN_DATA: TableConfig[] = [
    // --- TOP ROW ---
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

    // --- MIDDLE AREA ---
    { id: '53', x: 110, y: 200, width: 40, height: 40, shape: 'SQUARE' },
    { id: '52', x: 110, y: 260, width: 40, height: 40, shape: 'SQUARE' },
    { id: '51', x: 110, y: 320, width: 40, height: 40, shape: 'SQUARE' },
    { id: '50', x: 110, y: 380, width: 40, height: 40, shape: 'SQUARE' },
    { id: '11', x: 170, y: 200, width: 100, height: 120, shape: 'RECTANGULAR' },
    { id: '12', x: 170, y: 350, width: 100, height: 120, shape: 'RECTANGULAR' },

    // --- LEFT INNER STACK ---
    { id: '13', x: 150, y: 500, width: 40, height: 40, shape: 'ROUND' },
    { id: '14', x: 200, y: 500, width: 40, height: 40, shape: 'ROUND' },
    { id: '15', x: 250, y: 500, width: 40, height: 40, shape: 'ROUND' },
    { id: '16', x: 300, y: 420, width: 40, height: 40, shape: 'ROUND' },
    { id: '17', x: 300, y: 360, width: 40, height: 40, shape: 'ROUND' },
    { id: '18', x: 300, y: 300, width: 40, height: 40, shape: 'ROUND' },
    { id: '19', x: 300, y: 240, width: 40, height: 40, shape: 'ROUND' },

    // --- CAPSULE BOOTHS ---
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

    // --- BOTTOM AREA ---
    { id: '36', x: 360, y: 600, width: 40, height: 40, shape: 'ROUND' },
    { id: '35', x: 300, y: 600, width: 40, height: 40, shape: 'ROUND' },
    { id: '34', x: 240, y: 600, width: 40, height: 40, shape: 'ROUND' },
    { id: '33', x: 180, y: 600, width: 40, height: 40, shape: 'ROUND' },
    { id: '32', x: 120, y: 600, width: 40, height: 40, shape: 'ROUND' },
    { id: '31', x: 60, y: 600, width: 40, height: 40, shape: 'ROUND' },
    { id: '30', x: 0, y: 600, width: 40, height: 40, shape: 'ROUND' },

    // --- BAR ---
    // { id: '40', x: 450, y: 600, width: 30, height: 30, shape: 'BAR' },
    // { id: '42', x: 500, y: 600, width: 30, height: 30, shape: 'BAR' },
    // { id: '44', x: 550, y: 600, width: 30, height: 30, shape: 'BAR' },
    // { id: '46', x: 600, y: 600, width: 30, height: 30, shape: 'BAR' },
    // { id: '48', x: 650, y: 600, width: 30, height: 30, shape: 'BAR' },
];