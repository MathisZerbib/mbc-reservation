import { describe, it, expect } from 'vitest';
import { buildAdjacencyMap, parseLayoutTable } from './floorPlanService';

describe('buildAdjacencyMap', () => {
    it('unions both directions so one stored edge links both tables', () => {
        const tables = [
            { id: 1, name: '11' },
            { id: 2, name: '12' },
            { id: 3, name: '29' },
        ];
        const map = buildAdjacencyMap(tables, [{ aId: 1, bId: 2 }]);

        expect(map['11']).toEqual(['12']);
        expect(map['12']).toEqual(['11']);
        expect(map['29']).toEqual([]);
    });

    it('ignores edges referencing unknown tables', () => {
        const map = buildAdjacencyMap([{ id: 1, name: '11' }], [{ aId: 1, bId: 999 }]);
        expect(map['11']).toEqual([]);
    });
});

describe('parseLayoutTable', () => {
    const valid = {
        name: '42',
        capacity: 4,
        type: 'RECTANGULAR',
        x: 100,
        y: 200,
        width: 80,
        height: 80,
        rotation: 0,
        adjacentNames: ['11', '42', ' 12 '],
    };

    it('normalizes names, trims adjacency and drops self-links', () => {
        const parsed = parseLayoutTable(valid);
        expect(parsed.name).toBe('42');
        expect(parsed.adjacentNames).toEqual(['11', '12']);
    });

    it('rejects missing names, bad capacity and unknown types', () => {
        expect(() => parseLayoutTable({ ...valid, name: '  ' })).toThrow();
        expect(() => parseLayoutTable({ ...valid, capacity: 0 })).toThrow();
        expect(() => parseLayoutTable({ ...valid, capacity: 2.5 })).toThrow();
        expect(() => parseLayoutTable({ ...valid, type: 'HEXAGON' })).toThrow();
    });

    it('rejects out-of-range geometry', () => {
        expect(() => parseLayoutTable({ ...valid, width: 5 })).toThrow();
        expect(() => parseLayoutTable({ ...valid, x: -1 })).toThrow();
        expect(() => parseLayoutTable({ ...valid, rotation: 400 })).toThrow();
    });

    it('keeps positive ids but drops client-side temp ids', () => {
        expect(parseLayoutTable({ ...valid, id: 7 }).id).toBe(7);
        expect(parseLayoutTable({ ...valid, id: -1 }).id).toBeUndefined();
        expect(parseLayoutTable({ ...valid, id: 0 }).id).toBeUndefined();
        expect(parseLayoutTable({ ...valid, id: 2.5 }).id).toBeUndefined();
        expect(parseLayoutTable(valid).id).toBeUndefined();
    });
});
