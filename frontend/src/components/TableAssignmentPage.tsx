import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { FLOOR_PLAN_DATA, type TableConfig } from '../utils/floorPlanData';
import { ChevronLeft, Save, Users, Clock, Search, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { cn } from '../lib/utils';
import { api } from '../services/api';
import { DatePicker } from './ui/date-picker';
import { calculateAffluence, affluenceClassNames } from '../utils/bookingUtils';
import { useBookingsContext } from '../context/useBookingsContext';
import type { Booking } from '../types';

dayjs.extend(isBetween);

export const TableAssignmentPage: React.FC = () => {
    const { bookings, refresh } = useBookingsContext();
    const [searchParams] = useSearchParams();
    const initialDate = searchParams.get('date') || dayjs().format('YYYY-MM-DD');

    const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
    const [date, setDate] = useState(initialDate);
    const [loading, setLoading] = useState(false);
    const [tempTables, setTempTables] = useState<string[]>([]);
    const [hoveredTable, setHoveredTable] = useState<string | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [searchName, setSearchName] = useState('');
    const [searchSize, setSearchSize] = useState('');

    const selectedBooking = bookings.find(b => b.id === selectedBookingId);

    useEffect(() => {
        if (selectedBooking) {
            setTempTables(selectedBooking.tables.map(t => t.name));
        } else {
            setTempTables([]);
        }
    }, [selectedBookingId, bookings, selectedBooking]);

    const filteredBookings = bookings.filter(b =>
        dayjs(b.startTime).format('YYYY-MM-DD') === date &&
        b.status !== 'CANCELLED' &&
        b.status !== 'COMPLETED'
    ).filter(b => {
        // Name or Table search
        if (searchName) {
            const s = searchName.toLowerCase();
            const nameMatch = b.name.toLowerCase().includes(s);
            const tableMatch = b.tables?.some(t => t.name.toLowerCase().includes(s));
            if (!nameMatch && !tableMatch) return false;
        }
        // Size search
        if (searchSize) {
            if (b.size !== parseInt(searchSize)) return false;
        }
        return true;
    }).sort((a, b) => {
        const aAssigned = a.tables && a.tables.length > 0;
        const bAssigned = b.tables && b.tables.length > 0;
        // Unassigned first
        if (aAssigned !== bAssigned) return aAssigned ? 1 : -1;
        // Then by time
        return dayjs(a.startTime).unix() - dayjs(b.startTime).unix();
    });

    const hasOtherReservationsToday = (tableId: string) => {
        return filteredBookings.some(b =>
            (!selectedBooking || b.id !== selectedBooking.id) &&
            b.tables.some(t => t.name === tableId)
        );
    };

    const MAX_BOOKINGS_PER_TABLE = 3;

    const countOverlapping = (tableId: string) => {
        if (!selectedBooking) return 0;
        const buffer = 15;
        const requestedStart = dayjs(selectedBooking.startTime);
        const requestedEnd = dayjs(selectedBooking.endTime);

        return bookings.filter(b => {
            if (b.id === selectedBooking.id || b.status === 'CANCELLED') return false;
            const bStart = dayjs(b.startTime);
            const bEnd = dayjs(b.endTime);
            const overlaps = bStart.isBefore(requestedEnd.add(buffer, 'minute')) &&
                bEnd.isAfter(requestedStart.subtract(buffer, 'minute'));
            return overlaps && b.tables.some(t => t.name === tableId);
        }).length;
    };

    const isOccupiedByOthers = (tableId: string) => {
        return countOverlapping(tableId) >= MAX_BOOKINGS_PER_TABLE;
    };

    const toggleTable = React.useCallback((tableId: string) => {
        if (!selectedBooking || isOccupiedByOthers(tableId)) return;
        setTempTables(prev =>
            prev.includes(tableId) ? prev.filter(id => id !== tableId) : [...prev, tableId]
        );
    }, [selectedBooking, isOccupiedByOthers]);

    const handleMouseEnter = React.useCallback((id: string) => setHoveredTable(id), []);
    const handleMouseLeave = React.useCallback(() => setHoveredTable(null), []);

    const handleSave = async () => {
        if (!selectedBookingId) return;
        setLoading(true);
        try {
            await api.updateAssignment(selectedBookingId, tempTables);
            refresh();
            setSelectedBookingId(null);
        } catch {
            alert('Failed to save assignment');
        } finally {
            setLoading(false);
        }
    };

    const getShapePath = (table: TableConfig) => {
        const { width, height, shape } = table;
        switch (shape) {
            case 'OCTAGONAL':
                {
                    const corner = Math.min(width, height) * 0.3;
                    return `M ${corner} 0 H ${width - corner} L ${width} ${corner} V ${height - corner} L ${width - corner} ${height} H ${corner} L 0 ${height - corner} V ${corner} Z`;
                }
            case 'ROUND':
                return `M ${width / 2}, 0 A ${width / 2} ${height / 2} 0 1,1 ${width / 2} ${height} A ${width / 2} ${height / 2} 0 1,1 ${width / 2} 0`;
            case 'CAPSULE':
                {
                    const r = Math.min(width, height) / 2;
                    return width > height
                        ? `M ${r} 0 H ${width - r} A ${r} ${r} 0 0 1 ${width - r} ${height} H ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`
                        : `M 0 ${r} V ${height - r} A ${r} ${r} 0 0 0 ${width} ${height - r} V ${r} A ${r} ${r} 0 0 0 0 ${r} Z`;
                }
            case 'BAR':
                {
                    const r = Math.max(width, height) * 0.65;
                    const cx = width / 2;
                    const cy = height / 2;
                    return `M ${cx}, ${cy - r} A ${r} ${r} 0 1,1 ${cx} ${cy + r} A ${r} ${r} 0 1,1 ${cx} ${cy - r}`;
                }
            case 'SQUARE':
            case 'RECTANGULAR':
            default:
                return `M 0 0 H ${width} V ${height} H 0 Z`;
        }
    };

    const TableItem = React.memo(({
        table,
        isSelected,
        isHovered,
        isFull,
        isPartiallyOccupied,
        hasOtherRes,
        usageCount,
        onToggle,
        onMouseEnter,
        onMouseLeave,
        isDisabled
    }: {
        table: TableConfig,
        isSelected: boolean,
        isHovered: boolean,
        isFull: boolean,
        isPartiallyOccupied: boolean,
        hasOtherRes: boolean,
        usageCount: number,
        onToggle: (id: string) => void,
        onMouseEnter: (id: string) => void,
        onMouseLeave: () => void,
        isDisabled: boolean
    }) => {
        return (
            <g
                transform={`translate(${table.x}, ${table.y}) rotate(${table.rotation || 0}, ${table.width / 2}, ${table.height / 2}) scale(${isSelected || isHovered ? 1.05 : 1})`}
                onClick={() => onToggle(table.id)}
                onMouseEnter={() => onMouseEnter(table.id)}
                onMouseLeave={onMouseLeave}
                className={clsx(
                    "transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] select-none group",
                    isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
                )}
                style={{
                    filter: isHovered && !isDisabled ? 'drop-shadow(0 0 15px rgba(79, 70, 229, 0.6))' : 'url(#tableShadow)',
                    transformBox: 'fill-box',
                    transformOrigin: 'center'
                }}
            >
                <path
                    d={getShapePath(table)}
                    fill={isSelected ? '#4f46e5' : isFull ? '#cbd5e1' : isPartiallyOccupied ? '#fef3c7' : 'white'}
                    stroke={isSelected ? '#3730a3' : isFull ? '#94a3b8' : isPartiallyOccupied ? '#f59e0b' : hasOtherRes ? '#cbd5e1' : '#e2e8f0'}
                    strokeWidth={isSelected ? '3' : isPartiallyOccupied ? '2.5' : '2'}
                    className={clsx(
                        "transition-colors duration-200",
                        !isDisabled && !isSelected && "group-hover:fill-indigo-50 group-hover:stroke-indigo-300"
                    )}
                />

                {usageCount > 0 && (
                    <g pointerEvents="none">
                        <circle cx={table.width} cy={0} r="9" fill={isFull ? '#94a3b8' : '#f59e0b'} stroke="white" strokeWidth="2" />
                        <text x={table.width} y={0} dy="0.35em" textAnchor="middle" fill="white" fontSize="9" fontWeight="900">
                            {usageCount || 0}/{MAX_BOOKINGS_PER_TABLE}
                        </text>
                    </g>
                )}

                {isFull && (
                    <path d={`M ${table.width * 0.2} ${table.height * 0.2} L ${table.width * 0.8} ${table.height * 0.8} M ${table.width * 0.8} ${table.height * 0.2} L ${table.width * 0.2} ${table.height * 0.8}`} stroke="#94a3b8" strokeWidth="2" strokeOpacity="0.5" pointerEvents="none" />
                )}
                <text x={table.width / 2} y={table.height / 2} dy="0.35em" textAnchor="middle" fill={isSelected ? 'white' : isFull ? '#64748b' : isPartiallyOccupied ? '#92400e' : '#94a3b8'} fontSize="14" fontWeight="800" pointerEvents="none"
                    className={clsx("transition-colors duration-200", !isDisabled && !isSelected && "group-hover:fill-emerald-600")}
                >
                    {table.id}
                </text>
            </g>
        );
    });

    return (
        <div className="flex flex-col lg:flex-row h-screen bg-slate-100 overflow-hidden">
            {/* Sidebar */}
            <div className="w-full lg:w-96 h-1/3 lg:h-full bg-white border-r border-slate-200 flex flex-col shadow-xl z-10 shrink-0">
                <div className="p-6 border-b border-slate-100 bg-slate-900 text-white">
                    <div className="flex items-center gap-2 mb-4">
                        <a href={`/admin/dashboard?date=${date}`} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
                            <ChevronLeft className="w-5 h-5" />
                        </a>
                        <h1 className="text-xl font-bold tracking-tight">Table Assignments</h1>
                    </div>
                    <DatePicker
                        date={dayjs(date).toDate()}
                        setDate={d => setDate(dayjs(d).format('YYYY-MM-DD'))}
                        className="bg-slate-800 border-none text-white focus:ring-2 focus:ring-indigo-500 h-10 text-xs mb-4"
                        modifiers={calculateAffluence(bookings)}
                        modifiersClassNames={affluenceClassNames}
                    />

                    <div className="flex gap-2">
                        <div className="relative group flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search name or table..."
                                value={searchName}
                                onChange={e => setSearchName(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 pl-9 pr-4 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-500"
                            />
                            {searchName && (
                                <button
                                    onClick={() => setSearchName('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                                >
                                    <XCircle className="w-3 h-3 text-slate-500 hover:text-slate-300" />
                                </button>
                            )}
                        </div>

                        <div className="relative group w-20">
                            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
                            <input
                                type="number"
                                placeholder="Size"
                                value={searchSize}
                                onChange={e => setSearchSize(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 pl-9 pr-2 text-xs font-black text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-500 appearance-none"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {filteredBookings.length === 0 ? (
                        <div className="text-center py-20 text-slate-400 font-medium">No bookings for this date.</div>
                    ) : (
                        filteredBookings.map(b => (
                            <button
                                key={b.id}
                                onClick={() => setSelectedBookingId(prev => prev === b.id ? null : b.id)}
                                className={clsx(
                                    "w-full text-left p-4 rounded-2xl border transition-all duration-500 group relative cursor-pointer overflow-hidden",
                                    selectedBookingId === b.id
                                        ? "bg-indigo-50/50 border-indigo-500/40 ring-4 ring-indigo-500/5 shadow-lg shadow-indigo-500/10"
                                        : "bg-white border-slate-100 hover:border-indigo-200 hover:shadow-xl hover:shadow-slate-200/50 hover:scale-[1.01]"
                                )}
                            >
                                {selectedBookingId === b.id && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 animate-in slide-in-from-left duration-300"></div>
                                )}

                                <div className="flex justify-between items-start mb-3">
                                    <div className="min-w-0">
                                        <span className={clsx(
                                            "block font-black text-sm truncate tracking-tight transition-colors",
                                            selectedBookingId === b.id ? "text-indigo-700" : "text-slate-900 group-hover:text-indigo-600"
                                        )}>
                                            {b.language === 'fr' ? '🇫🇷 ' : b.language === 'en' ? '🇬🇧 ' : b.language === 'it' ? '🇮🇹 ' : ''}
                                            {b.name}
                                        </span>
                                    </div>
                                    <div className={clsx(
                                        "shrink-0 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md border flex items-center gap-1.5",
                                        b.tables.length > 0
                                            ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                            : "bg-red-50 text-red-600 border-red-100"
                                    )}>
                                        {b.tables.length === 0 && <div className="w-1 h-1 bg-red-500 rounded-full animate-pulse" />}
                                        {b.tables.length > 0 ? "Mapped" : "Unmapped"}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg">
                                        <Clock className="w-3 h-3 text-slate-400" />
                                        <span className="text-[10px] font-black text-slate-600">{dayjs(b.startTime).format('HH:mm')}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg">
                                        <Users className="w-3 h-3 text-slate-400" />
                                        <span className="text-[10px] font-black text-slate-700">{b.size} guests</span>
                                        {b.lowTable && <span className="text-[8px] font-black bg-indigo-600 text-white px-1.5 py-0.5 rounded-sm ml-0.5 tracking-tighter">LOW</span>}
                                    </div>
                                </div>

                                {b.tables.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-1 border-t border-slate-100/50 pt-3">
                                        {b.tables.map(t => (
                                            <span key={t.id} className="text-[9px] font-black text-slate-400 border border-slate-100 px-1.5 py-0.5 rounded uppercase tracking-tighter group-hover:border-indigo-100 group-hover:text-indigo-400 transition-colors">
                                                {t.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </button>
                        ))
                    )}
                </div>

                {selectedBooking && (
                    <div className="p-4 bg-slate-50 border-t border-slate-200 animate-in slide-in-from-bottom duration-300">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Selected Tables ({tempTables.length})</span>
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                            >
                                <Save className="w-4 h-4" /> {loading ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {tempTables.length === 0 ? (
                                <span className="text-xs text-slate-400 italic">None selected yet...</span>
                            ) : (
                                tempTables.map(t => (
                                    <span key={t} className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-bold border border-indigo-200 shrink-0">{t}</span>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Main View: Interactive Floor Plan */}
            <div className="flex-1 flex flex-col relative">

                <div className="p-4 lg:p-8 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">Interactive <span className="text-indigo-600">Assigner</span></h2>
                        {selectedBooking && <p className="text-sm text-slate-500 font-medium">Assigning for <span className="text-slate-900 font-bold">{selectedBooking.name}</span> &middot; {selectedBooking.size} people @ {dayjs(selectedBooking.startTime).format('HH:mm')}</p>}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                        <div className="flex items-center gap-2 text-[10px] lg:text-xs font-bold text-slate-500"><div className="w-3 h-3 rounded bg-white border border-slate-300"></div> AVAILABLE</div>
                        <div className="flex items-center gap-2 text-[10px] lg:text-xs font-bold text-slate-500"><div className="w-3 h-3 rounded bg-indigo-600 shadow-sm shadow-indigo-500/50"></div> SELECTED</div>
                        <div className="flex items-center gap-2 text-[10px] lg:text-xs font-bold text-amber-500"><div className="w-3 h-3 rounded bg-amber-100 border border-amber-300"></div> SHARED (1-2/{MAX_BOOKINGS_PER_TABLE})</div>
                        <div className="flex items-center gap-2 text-[10px] lg:text-xs font-bold text-slate-500"><div className="w-3 h-3 rounded bg-slate-300 opacity-50"></div> FULL ({MAX_BOOKINGS_PER_TABLE}/{MAX_BOOKINGS_PER_TABLE})</div>
                    </div>
                </div>

                <div className="flex-1 p-8 pt-4 overflow-hidden relative">
                    <div
                        className="w-full h-full bg-white rounded-2xl lg:rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden relative"
                        onMouseMove={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                        }}
                    >
                        <svg width="100%" height="100%" viewBox="0 0 1000 800" className="w-full h-full bg-slate-50/50 cursor-grab active:cursor-grabbing">
                            <defs>
                                <pattern id="dots" width="30" height="30" patternUnits="userSpaceOnUse">
                                    <circle cx="1" cy="1" r="1" fill="#e2e8f0" />
                                </pattern>
                                <filter id="tableShadow">
                                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.1" />
                                </filter>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#dots)" />

                            {FLOOR_PLAN_DATA.map((table) => {
                                const usageCount = selectedBooking ? countOverlapping(table.id) : filteredBookings.filter(b => b.tables.some(t => t.name === table.id)).length;
                                const isFull = usageCount >= MAX_BOOKINGS_PER_TABLE;
                                const isPartiallyOccupied = usageCount > 0 && usageCount < MAX_BOOKINGS_PER_TABLE;
                                const hasOtherRes = hasOtherReservationsToday(table.id);
                                const isSelected = tempTables.includes(table.id);
                                const isHovered = hoveredTable === table.id;
                                const isDisabled = isFull && !!selectedBooking;

                                return (
                                    <TableItem
                                        key={table.id}
                                        table={table}
                                        isSelected={isSelected}
                                        isHovered={isHovered}
                                        isFull={isFull}
                                        isPartiallyOccupied={isPartiallyOccupied}
                                        hasOtherRes={hasOtherRes}
                                        usageCount={usageCount}
                                        onToggle={toggleTable}
                                        onMouseEnter={handleMouseEnter}
                                        onMouseLeave={handleMouseLeave}
                                        isDisabled={isDisabled}
                                    />
                                );
                            })}
                        </svg>

                        {/* Improved Tooltip with Framer Motion */}
                        <AnimatePresence>
                            {hoveredTable && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{
                                        opacity: 1,
                                        scale: 1,
                                        x: mousePos.x + 20,
                                        y: mousePos.y + 20 + (mousePos.y > 260 ? -320 : 0) // Adjusting for height
                                    }}
                                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                    transition={{
                                        type: "spring",
                                        damping: 25,
                                        stiffness: 300,
                                        opacity: { duration: 0.2 }
                                    }}
                                    className="absolute top-0 left-0 z-50 pointer-events-none bg-slate-900/95 backdrop-blur-2xl text-white p-5 rounded-[2rem] shadow-[0_25px_70px_rgba(0,0,0,0.4)] border border-white/10 min-w-64"
                                    style={{
                                        transformOrigin: "top left",
                                    }}
                                >
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] leading-none mb-1.5">Selected Table</span>
                                            <span className="text-2xl font-black tracking-tight leading-none">Table {hoveredTable}</span>
                                        </div>
                                        {selectedBooking && (
                                            <div className={cn(
                                                "px-3 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-wider border flex items-center gap-2",
                                                countOverlapping(hoveredTable) >= MAX_BOOKINGS_PER_TABLE
                                                    ? "bg-red-500/20 text-red-200 border-red-500/30"
                                                    : countOverlapping(hoveredTable) > 0
                                                        ? "bg-amber-500/20 text-amber-200 border-amber-500/30"
                                                        : "bg-emerald-500/20 text-emerald-200 border-emerald-500/30"
                                            )}>
                                                <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse",
                                                    countOverlapping(hoveredTable) >= MAX_BOOKINGS_PER_TABLE ? "bg-red-400" :
                                                        countOverlapping(hoveredTable) > 0 ? "bg-amber-400" : "bg-emerald-400"
                                                )} />
                                                {countOverlapping(hoveredTable)}/{MAX_BOOKINGS_PER_TABLE} Capacity
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        {filteredBookings.filter((b: Booking) =>
                                            b.tables?.some((t) => t.name === hoveredTable)
                                        ).length === 0 ? (
                                            <div className="py-6 border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center">
                                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Available All Day</p>
                                                <p className="text-[10px] text-slate-600 font-medium mt-1">No overlapping reservations</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                                {filteredBookings
                                                    .filter((b: Booking) =>
                                                        b.tables?.some((t) => t.name === hoveredTable)
                                                    )
                                                    .sort((a, b) => dayjs(a.startTime).diff(dayjs(b.startTime)))
                                                    .map((b: Booking) => {
                                                        const isCurrent = dayjs().isBetween(dayjs(b.startTime), dayjs(b.endTime));
                                                        const isThisBooking = selectedBooking && b.id === selectedBooking.id;
                                                        return (
                                                            <div
                                                                key={b.id}
                                                                className={cn(
                                                                    "p-3 rounded-2xl border transition-all duration-300 flex flex-col gap-2",
                                                                    isThisBooking
                                                                        ? "bg-indigo-600 border-indigo-400 shadow-[0_10px_30px_rgba(79,70,229,0.3)] text-white"
                                                                        : isCurrent
                                                                            ? "bg-emerald-600/20 border-emerald-400/30 text-white"
                                                                            : "bg-white/5 border-white/10 text-slate-300"
                                                                )}
                                                            >
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-sm font-black leading-none tracking-tight">
                                                                        {b.language === 'fr' ? '🇫🇷 ' : b.language === 'en' ? '🇬🇧 ' : b.language === 'it' ? '🇮🇹 ' : ''}
                                                                        {b.name}
                                                                    </span>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <Clock className="w-3 h-3 opacity-50" />
                                                                        <span className="text-[10px] font-black">{dayjs(b.startTime).format('HH:mm')}</span>
                                                                    </div>
                                                                </div>
                                                                <div className={cn(
                                                                    "text-[10px] font-bold flex justify-between items-center",
                                                                    isThisBooking ? "text-indigo-100" : "text-slate-500"
                                                                )}>
                                                                    <div className="flex items-center gap-2">
                                                                        <Users className="w-3 h-3" />
                                                                        {b.size} guests
                                                                    </div>
                                                                    <span className="opacity-70 italic text-[9px]">until {dayjs(b.endTime).format('HH:mm')}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
};
