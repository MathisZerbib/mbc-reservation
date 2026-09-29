import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Save, Plus, Trash2, MousePointer2, Link2, Loader2, X } from 'lucide-react';
import { api } from '../services/api';
import { useRestaurantSettings, useTenant } from '../hooks/useFloorPlan';
import { useTranslation } from '../i18n/useTranslation';
import { FLOOR_PLAN_DATA, tableShapePath } from '../utils/floorPlanData';
import type { LayoutTable, LayoutTableType } from '../types/index';
import { cn } from '../lib/utils';

const TABLE_TYPES: LayoutTableType[] = ['RECTANGULAR', 'SQUARE', 'ROUND', 'OCTAGONAL', 'CAPSULE', 'BAR'];
const TEMP_ID = () => -Math.floor(Math.random() * 1_000_000_000);

const center = (t: LayoutTable) => ({ x: (t.x ?? 0) + t.width / 2, y: (t.y ?? 0) + t.height / 2 });

/** Fallback working copy from shipped constants so first save persists them. */
const fallbackCopy = (): LayoutTable[] =>
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

export const FloorPlanEditor: React.FC = () => {
    const { t: tr } = useTranslation();
    const { backgroundUrl } = useRestaurantSettings();
    const { tenant } = useTenant();
    const [tables, setTables] = useState<LayoutTable[] | null>(null);
    const [deleteIds, setDeleteIds] = useState<number[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const [tool, setTool] = useState<'select' | 'link'>('select');
    const [pendingLink, setPendingLink] = useState<string | null>(null);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const dragRef = useRef<{ name: string; dx: number; dy: number } | null>(null);

    useEffect(() => {
        if (!tenant) return;
        api.getLayout(tenant.slug)
            .then(layout => setTables(layout.length > 0 ? layout : fallbackCopy()))
            .catch(() => setTables(fallbackCopy()));
    }, [tenant]);

    const byName = useMemo(() => new Map((tables ?? []).map(t => [t.name, t])), [tables]);
    const selectedTable = selected ? byName.get(selected) ?? null : null;

    const flash = (kind: 'ok' | 'err', text: string) => {
        setMessage({ kind, text });
        window.setTimeout(() => setMessage(null), 5000);
    };

    const mutate = (next: LayoutTable[]) => {
        setTables(next);
        setDirty(true);
    };

    const toSvgCoords = (e: React.PointerEvent) => {
        const svg = svgRef.current;
        if (!svg) return { x: 0, y: 0 };
        const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()?.inverse());
        return { x: pt.x, y: pt.y };
    };

    // ── Table clicks ──
    const handleTablePointerDown = (e: React.PointerEvent, table: LayoutTable) => {
        if (tool === 'link') return; // handled on click to avoid drag interference
        e.stopPropagation();
        setSelected(table.name);
        const p = toSvgCoords(e);
        dragRef.current = { name: table.name, dx: p.x - (table.x ?? 0), dy: p.y - (table.y ?? 0) };
    };

    const handleSvgPointerMove = (e: React.PointerEvent) => {
        const drag = dragRef.current;
        if (!drag || !tables) return;
        const p = toSvgCoords(e);
        const nx = Math.round(Math.max(0, Math.min(2000, p.x - drag.dx)));
        const ny = Math.round(Math.max(0, Math.min(2000, p.y - drag.dy)));
        mutate(tables.map(t => (t.name === drag.name ? { ...t, x: nx, y: ny } : t)));
    };

    const endDrag = () => {
        dragRef.current = null;
    };

    const toggleEdge = (a: string, b: string) => {
        if (!tables || a === b) return;
        const linked = byName.get(a)?.adjacentNames.includes(b) ?? false;
        mutate(
            tables.map(t => {
                if (t.name === a) {
                    return { ...t, adjacentNames: linked ? t.adjacentNames.filter(n => n !== b) : [...t.adjacentNames, b] };
                }
                if (t.name === b) {
                    return { ...t, adjacentNames: linked ? t.adjacentNames.filter(n => n !== a) : [...t.adjacentNames, a] };
                }
                return t;
            }),
        );
    };

    const handleTableClick = (table: LayoutTable) => {
        if (tool !== 'link') return;
        if (!pendingLink) {
            setPendingLink(table.name);
            setSelected(table.name);
            return;
        }
        if (pendingLink === table.name) {
            setPendingLink(null);
            return;
        }
        toggleEdge(pendingLink, table.name);
        setPendingLink(table.name);
        setSelected(table.name);
    };

    // ── Panel edits ──
    const patchSelected = (patch: Partial<LayoutTable>) => {
        if (!selectedTable || !tables) return;
        // Renames must follow into every adjacency list.
        if (patch.name !== undefined && patch.name !== selectedTable.name) {
            const nextName = patch.name;
            mutate(
                tables.map(t => ({
                    ...t,
                    ...(t.name === selectedTable.name ? { ...t, ...patch } : t),
                    adjacentNames: t.adjacentNames.map(n => (n === selectedTable.name ? nextName : n)),
                })),
            );
            setSelected(nextName);
            return;
        }
        mutate(tables.map(t => (t.name === selectedTable.name ? { ...t, ...patch } : t)));
    };

    const handleAdd = () => {
        if (!tables) return;
        const used = new Set(tables.map(t => t.name));
        let n = 1;
        while (used.has(String(n))) n += 1;
        mutate([
            ...tables,
            { id: TEMP_ID(), name: String(n), capacity: 2, type: 'RECTANGULAR', x: 450, y: 350, width: 60, height: 80, rotation: 0, adjacentNames: [] },
        ]);
        setSelected(String(n));
        setTool('select');
    };

    const handleDelete = () => {
        if (!selectedTable || !tables) return;
        if (selectedTable.id > 0) setDeleteIds(prev => [...prev, selectedTable.id]);
        mutate(
            tables
                .filter(t => t.name !== selectedTable.name)
                .map(t => ({ ...t, adjacentNames: t.adjacentNames.filter(n => n !== selectedTable.name) })),
        );
        setSelected(null);
    };

    const handleSave = async () => {
        if (!tables) return;
        setSaving(true);
        try {
            // Temp ids are stripped so the backend upserts newcomers by name.
            const payload = tables.map(t => (t.id < 0 ? { ...t, id: undefined } : t));
            const saved = await api.saveLayout(payload as LayoutTable[], deleteIds);
            setTables(saved);
            setDeleteIds([]);
            setDirty(false);
            flash('ok', tr('editor.saved'));
        } catch (e) {
            flash('err', e instanceof Error ? e.message : tr('editor.saveFailed'));
        } finally {
            setSaving(false);
        }
    };

    // Rendered once per pair (undirected).
    const edges = useMemo(() => {
        if (!tables) return [];
        const seen = new Set<string>();
        const out: { a: LayoutTable; b: LayoutTable }[] = [];
        for (const t of tables) {
            for (const n of t.adjacentNames) {
                const other = byName.get(n);
                if (!other) continue;
                const key = t.name < n ? `${t.name}|${n}` : `${n}|${t.name}`;
                if (seen.has(key)) continue;
                seen.add(key);
                out.push({ a: t, b: other });
            }
        }
        return out;
    }, [tables, byName]);

    const NumField = ({ label, value, onChange, min, max, step = 1 }: {
        label: string; value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void;
    }) => (
        <label className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
            <input
                type="number"
                value={value}
                min={min}
                max={max}
                step={step}
                onChange={e => onChange(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
        </label>
    );

    return (
        <div className="h-screen bg-slate-100 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex-none px-4 lg:px-6 py-3 flex items-center gap-2 lg:gap-3 bg-white border-b border-slate-200">
                <Link to="/admin/settings" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                    <ChevronLeft className="w-5 h-5 text-slate-500" />
                </Link>
                <h1 className="text-base lg:text-xl font-black text-slate-900 tracking-tight mr-auto">
                    {tr('editor.title')} <span className="text-indigo-600">{tr('editor.editorAccent')}</span>
                </h1>
                {dirty && (
                    <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                        {tr('editor.unsaved')}
                    </span>
                )}
                <div className="flex bg-slate-200/50 p-1 rounded-xl border border-slate-200/50">
                    <button
                        onClick={() => { setTool('select'); setPendingLink(null); }}
                        className={cn("px-3 lg:px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5", tool === 'select' ? "bg-white shadow-md text-indigo-600" : "text-slate-500")}
                    >
                        <MousePointer2 className="w-3.5 h-3.5" /> {tr('editor.select')}
                    </button>
                    <button
                        onClick={() => setTool('link')}
                        className={cn("px-3 lg:px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5", tool === 'link' ? "bg-white shadow-md text-indigo-600" : "text-slate-500")}
                    >
                        <Link2 className="w-3.5 h-3.5" /> {tr('editor.link')}
                    </button>
                </div>
                <button
                    onClick={handleAdd}
                    className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all cursor-pointer"
                    title={tr('editor.addTable')}
                >
                    <Plus className="w-4 h-4" />
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving || !dirty}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 lg:px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 active:scale-95 transition-all cursor-pointer shadow-lg shadow-indigo-600/20"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span className="hidden sm:inline">{tr('editor.save')}</span>
                </button>
            </div>

            {message && (
                <div className={cn(
                    "flex-none mx-4 lg:mx-6 mt-3 px-4 py-2.5 rounded-2xl text-sm font-bold border",
                    message.kind === 'ok' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"
                )}>
                    {message.text}
                </div>
            )}

            {tool === 'link' && (
                <div className="flex-none mx-4 lg:mx-6 mt-3 px-4 py-2.5 rounded-2xl text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {pendingLink
                        ? <>{tr('editor.linkActivePre')} <span className="font-black">{tr('editor.tableTitle').replace('{name}', pendingLink)}</span> {tr('editor.linkActivePost')}</>
                        : tr('editor.linkIdle')}
                </div>
            )}

            {/* Main */}
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 p-3 lg:p-6">
                <div className="flex-1 min-h-[50vh] lg:min-h-0 bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden">
                    {!tables ? (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-sm">
                            <Loader2 className="w-5 h-5 animate-spin mr-2" /> {tr('editor.loading')}
                        </div>
                    ) : (
                        <svg
                            ref={svgRef}
                            viewBox="0 0 1000 800"
                            preserveAspectRatio="xMidYMid meet"
                            className={cn("w-full h-full bg-slate-50/50", tool === 'link' ? "cursor-crosshair" : "cursor-default")}
                            onPointerMove={handleSvgPointerMove}
                            onPointerUp={endDrag}
                            onPointerLeave={endDrag}
                            onClick={() => { if (tool === 'select') setSelected(null); }}
                        >
                            <defs>
                                <pattern id="editor-dots" width="30" height="30" patternUnits="userSpaceOnUse">
                                    <circle cx="1" cy="1" r="1" fill="#e2e8f0" />
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#editor-dots)" />
                            {backgroundUrl && (
                                <image href={backgroundUrl} x={0} y={0} width={1000} height={800} preserveAspectRatio="xMidYMid slice" opacity={0.4} />
                            )}

                            {/* Adjacency edges */}
                            {edges.map(({ a, b }) => {
                                const ca = center(a);
                                const cb = center(b);
                                const active = tool === 'link' || a.name === selected || b.name === selected;
                                return (
                                    <line
                                        key={`${a.name}|${b.name}`}
                                        x1={ca.x} y1={ca.y} x2={cb.x} y2={cb.y}
                                        stroke={active ? "#4f46e5" : "#cbd5e1"}
                                        strokeWidth={active ? 3 : 1.5}
                                        strokeDasharray="6 4"
                                        opacity={active ? 0.9 : 0.5}
                                        pointerEvents="none"
                                    />
                                );
                            })}

                            {tables.map(t => {
                                const isSelected = t.name === selected;
                                const isPending = t.name === pendingLink;
                                return (
                                    <g
                                        key={t.name}
                                        transform={`translate(${t.x ?? 0}, ${t.y ?? 0}) rotate(${t.rotation || 0}, ${t.width / 2}, ${t.height / 2})`}
                                        onPointerDown={e => handleTablePointerDown(e, t)}
                                        onClick={e => { e.stopPropagation(); handleTableClick(t); }}
                                        className={tool === 'link' ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}
                                    >
                                        <path
                                            d={tableShapePath({ width: t.width, height: t.height, shape: t.type })}
                                            fill={isPending ? '#c7d2fe' : isSelected ? '#4f46e5' : 'white'}
                                            stroke={isPending || isSelected ? '#3730a3' : '#94a3b8'}
                                            strokeWidth={isSelected || isPending ? 3 : 2}
                                        />
                                        <text x={t.width / 2} y={t.height / 2 - 4} dy="0.35em" textAnchor="middle" fill={isSelected ? 'white' : '#334155'} fontSize="14" fontWeight="800" pointerEvents="none">
                                            {t.name}
                                        </text>
                                        <text x={t.width / 2} y={t.height / 2 + 12} dy="0.35em" textAnchor="middle" fill={isSelected ? '#e0e7ff' : '#94a3b8'} fontSize="9" fontWeight="700" pointerEvents="none">
                                            {t.capacity} {tr('editor.seatsSuffix')}
                                        </text>
                                    </g>
                                );
                            })}
                        </svg>
                    )}
                </div>

                {/* Side panel */}
                <div className="w-full lg:w-80 flex-none bg-white rounded-[2rem] shadow-xl border border-slate-200 p-5 overflow-y-auto max-h-[40vh] lg:max-h-none">
                    {!selectedTable ? (
                        <div className="h-full flex flex-col items-center justify-center text-center py-10">
                            <p className="text-sm font-black text-slate-700">{tr('editor.noSelection')}</p>
                            <p className="text-xs text-slate-400 font-medium mt-1">
                                {tool === 'link' ? tr('editor.hintLink') : tr('editor.hintSelect')}
                            </p>
                            <button onClick={handleAdd} className="mt-4 inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">
                                <Plus className="w-3.5 h-3.5" /> {tr('editor.addTable')}
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <h2 className="text-base font-black text-slate-900">{tr('editor.tableTitle').replace('{name}', selectedTable.name)}</h2>
                                <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 cursor-pointer">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <label className="flex flex-col gap-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('editor.nameLabel')}</span>
                                <input
                                    type="text"
                                    value={selectedTable.name}
                                    maxLength={20}
                                    onChange={e => patchSelected({ name: e.target.value.trim() === '' ? selectedTable.name : e.target.value })}
                                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                />
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <NumField label={tr('editor.seatsLabel')} value={selectedTable.capacity} min={1} max={50} onChange={v => patchSelected({ capacity: Math.round(v) || 1 })} />
                                <label className="flex flex-col gap-1">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('editor.shapeLabel')}</span>
                                    <select
                                        value={selectedTable.type}
                                        onChange={e => patchSelected({ type: e.target.value as LayoutTableType })}
                                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    >
                                        {TABLE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </label>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <NumField label="X" value={selectedTable.x ?? 0} min={0} max={2000} onChange={v => patchSelected({ x: v })} />
                                <NumField label="Y" value={selectedTable.y ?? 0} min={0} max={2000} onChange={v => patchSelected({ y: v })} />
                                <NumField label={tr('editor.widthLabel')} value={selectedTable.width} min={10} max={2000} onChange={v => patchSelected({ width: v })} />
                                <NumField label={tr('editor.heightLabel')} value={selectedTable.height} min={10} max={2000} onChange={v => patchSelected({ height: v })} />
                            </div>
                            <NumField label={tr('editor.rotationLabel')} value={selectedTable.rotation} min={-360} max={360} onChange={v => patchSelected({ rotation: v })} />

                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    {tr('editor.linked').replace('{n}', String(selectedTable.adjacentNames.length))}
                                </span>
                                {selectedTable.adjacentNames.length === 0 ? (
                                    <p className="text-xs text-slate-400 font-medium mt-1">{tr('editor.notLinked')}</p>
                                ) : (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {selectedTable.adjacentNames.map(n => (
                                            <span key={n} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-1 rounded-lg text-xs font-bold">
                                                {n}
                                                <button onClick={() => toggleEdge(selectedTable.name, n)} className="hover:text-red-600 cursor-pointer">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleDelete}
                                className="mt-1 inline-flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer"
                            >
                                <Trash2 className="w-4 h-4" /> {tr('editor.deleteTable')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
