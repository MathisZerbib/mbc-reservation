import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { FLOOR_PLAN_DATA, type TableConfig } from '../utils/floorPlanData';
import { ChevronLeft, Save, Users, Clock } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../services/api';
import { DatePicker } from './ui/date-picker';
import { useBookingsContext } from '../context/useBookingsContext';

export const TableAssignmentPage: React.FC = () => {
    const { bookings, refresh } = useBookingsContext();
    const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
    const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [loading, setLoading] = useState(false);
    const [tempTables, setTempTables] = useState<string[]>([]);

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
        b.status !== 'CANCELLED'
    );
    
    const isReservedAnyTimeToday = (tableId: string) => {
        return filteredBookings.some(b => b.tables.some(t => t.name === tableId));
    };

    const isOccupiedByOthers = (tableId: string) => {
        if (!selectedBooking) return false;
        const buffer = 15;
        const requestedStart = dayjs(selectedBooking.startTime);
        const requestedEnd = dayjs(selectedBooking.endTime);

        return bookings.some(b => {
            if (b.id === selectedBooking.id || b.status === 'CANCELLED') return false;
            const bStart = dayjs(b.startTime);
            const bEnd = dayjs(b.endTime);
            const overlaps = bStart.isBefore(requestedEnd.add(buffer, 'minute')) && 
                             bEnd.isAfter(requestedStart.subtract(buffer, 'minute'));
            return overlaps && b.tables.some(t => t.name === tableId);
        });
    };

    const toggleTable = (tableId: string) => {
        if (!selectedBooking || isOccupiedByOthers(tableId)) return;
        setTempTables(prev => 
            prev.includes(tableId) ? prev.filter(id => id !== tableId) : [...prev, tableId]
        );
    };

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
                { const corner = Math.min(width, height) * 0.3;
                return `M ${corner} 0 H ${width - corner} L ${width} ${corner} V ${height - corner} L ${width - corner} ${height} H ${corner} L 0 ${height - corner} V ${corner} Z`; }
            case 'ROUND':
                return `M ${width/2}, 0 A ${width/2} ${height/2} 0 1,1 ${width/2} ${height} A ${width/2} ${height/2} 0 1,1 ${width/2} 0`;
            case 'CAPSULE':
                { const r = Math.min(width, height) / 2;
                return width > height 
                    ? `M ${r} 0 H ${width - r} A ${r} ${r} 0 0 1 ${width - r} ${height} H ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`
                    : `M 0 ${r} V ${height - r} A ${r} ${r} 0 0 0 ${width} ${height - r} V ${r} A ${r} ${r} 0 0 0 0 ${r} Z`; }
            case 'BAR':
                return `M ${width / 2}, 0 A ${width / 2} ${width / 2} 0 1,1 ${width / 2} ${width} A ${width / 2} ${width / 2} 0 1,1 ${width / 2} 0`;
            case 'SQUARE':
            case 'RECTANGULAR':
            default:
                return `M 0 0 H ${width} V ${height} H 0 Z`;
        }
    };

    return (
        <div className="flex h-screen bg-slate-100 overflow-hidden">
            {/* Sidebar */}
            <div className="w-96 bg-white border-r border-slate-200 flex flex-col shadow-xl z-10">
                <div className="p-6 border-b border-slate-100 bg-slate-900 text-white">
                    <div className="flex items-center gap-2 mb-4">
                        <a href="/" className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
                            <ChevronLeft className="w-5 h-5" />
                        </a>
                        <h1 className="text-xl font-bold tracking-tight">Table Assignments</h1>
                    </div>
                    <DatePicker 
                        date={dayjs(date).toDate()} 
                        setDate={d => setDate(dayjs(d).format('YYYY-MM-DD'))}
                        className="bg-slate-800 border-none text-white focus:ring-2 focus:ring-indigo-500 h-10 text-xs"
                    />
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {filteredBookings.length === 0 ? (
                        <div className="text-center py-20 text-slate-400 font-medium">No bookings for this date.</div>
                    ) : (
                        filteredBookings.map(b => (
                            <button
                                key={b.id}
                                onClick={() => setSelectedBookingId(b.id)}
                                className={clsx(
                                    "w-full text-left p-4 rounded-2xl border transition-all duration-200 group relative cursor-pointer",
                                    selectedBookingId === b.id 
                                        ? "bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/20" 
                                        : "bg-white border-slate-100 hover:border-slate-300 hover:shadow-md"
                                )}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{b.name}</span>
                                    <span className={clsx(
                                        "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                                        b.tables.length > 0 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
                                    )}>
                                        {b.tables.length > 0 ? "Assigned" : "Unassigned"}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 font-medium">
                                    <div className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {dayjs(b.startTime).format('HH:mm')} - {dayjs(b.endTime).format('HH:mm')}</div>
                                    <div className="flex items-center gap-1.5"><Users className="w-3 h-3" /> {b.size} guests</div>
                                </div>
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

                <div className="p-8 pb-4 flex justify-between items-center">
                    <div>
                         <h2 className="text-3xl font-black text-slate-900 tracking-tight">Interactive <span className="text-indigo-600">Assigner</span></h2>
                         {selectedBooking && <p className="text-slate-500 font-medium">Assigning for <span className="text-slate-900 font-bold">{selectedBooking.name}</span> &middot; {selectedBooking.size} people</p>}
                    </div>
                    <div className="flex gap-4">
                         <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><div className="w-3 h-3 rounded bg-white border border-slate-300"></div> AVAILABLE</div>
                         <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><div className="w-3 h-3 rounded bg-indigo-600 shadow-sm shadow-indigo-500/50"></div> SELECTED</div>
                         <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><div className="w-3 h-3 rounded bg-slate-300 opacity-50"></div> OCCUPIED</div>
                    </div>
                </div>

                <div className="flex-1 p-8 pt-4 overflow-hidden relative">
                    <div className="w-full h-full bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden relative">
                        <svg width="100%" height="100%" viewBox="0 0 1000 800" className="w-full h-full bg-slate-50/50 cursor-grab active:cursor-grabbing">
                            <defs>
                                <pattern id="dots" width="30" height="30" patternUnits="userSpaceOnUse">
                                    <circle cx="1" cy="1" r="1" fill="#e2e8f0" />
                                </pattern>
                                <filter id="tableShadow">
                                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.1"/>
                                </filter>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#dots)" />

                            {FLOOR_PLAN_DATA.map((table) => {
                                const occupiedByOthers = selectedBooking 
                                    ? isOccupiedByOthers(table.id) 
                                    : isReservedAnyTimeToday(table.id);
                                const isSelected = tempTables.includes(table.id);
                                
                                return (
                                    <g 
                                        key={table.id} 
                                        transform={`translate(${table.x}, ${table.y}) rotate(${table.rotation || 0}, ${table.width/2}, ${table.height/2}) scale(${isSelected ? 1.05 : 1})`}
                                        onClick={() => toggleTable(table.id)}
                                        className={clsx(
                                            "transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] select-none group",
                                            occupiedByOthers ? "opacity-30 cursor-not-allowed" : "cursor-pointer"
                                        )}
                                        style={{ 
                                          filter: 'url(#tableShadow)',
                                          transformBox: 'fill-box',
                                          transformOrigin: 'center'
                                        }}
                                    >
                                        <path 
                                            d={getShapePath(table)} 
                                            fill={isSelected ? '#4f46e5' : occupiedByOthers ? '#94a3b8' : 'white'} 
                                            stroke={isSelected ? '#3730a3' : '#e2e8f0'} 
                                            strokeWidth={isSelected ? '3' : '2'}
                                            className={clsx(
                                                "transition-colors duration-200",
                                                !occupiedByOthers && !isSelected && "group-hover:fill-emerald-50 group-hover:stroke-emerald-500"
                                            )}
                                        />
                                        {occupiedByOthers && (
                                            <path 
                                                d={`M 0 0 L ${table.width} ${table.height} M ${table.width} 0 L 0 ${table.height}`} 
                                                stroke="#ef4444" 
                                                strokeWidth="1" 
                                                strokeOpacity="0.3"
                                                pointerEvents="none"
                                            />
                                        )}
                                        <text 
                                            x={table.width / 2} 
                                            y={table.height / 2} 
                                            dy="0.35em" 
                                            textAnchor="middle" 
                                            fill={isSelected ? 'white' : occupiedByOthers ? '#64748b' : '#94a3b8'} 
                                            fontSize="14" 
                                            fontWeight="800"
                                            pointerEvents="none"
                                            className={clsx(
                                                "transition-colors duration-200",
                                                !occupiedByOthers && !isSelected && "group-hover:fill-emerald-600"
                                            )}
                                        >
                                            {table.id}
                                        </text>
                                    </g>
                                );
                            })}
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    );
};
