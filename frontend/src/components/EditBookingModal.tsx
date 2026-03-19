import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Phone, Users, Clock, Check, Loader2, Mail, ChevronDown, Search, Pencil } from 'lucide-react';
import { api } from '../services/api';
import { DatePicker } from './ui/date-picker';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "./ui/popover";
import { COUNTRIES } from '../utils/countries';
import { cn } from '../lib/utils';
import { useBookingsContext } from '../context/useBookingsContext';
import dayjs, { RESTAURANT_TZ } from '../utils/dayjs';
import type { Booking } from '../types/index';

interface EditBookingModalProps {
    booking: Booking | null;
    onClose: () => void;
}

const TIME_SLOTS = ['16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'];

/** Parse a stored phone string into dial code + local number */
function parsePhone(phone: string | undefined): { country: typeof COUNTRIES[0]; local: string } {
    const defaultCountry = COUNTRIES[0];
    if (!phone) return { country: defaultCountry, local: '' };

    // Sort by dial length descending so longer codes match first (+971 before +9)
    const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
    for (const c of sorted) {
        if (phone.startsWith(c.dial)) {
            return { country: c, local: phone.slice(c.dial.length).trim() };
        }
    }
    return { country: defaultCountry, local: phone };
}

export const EditBookingModal: React.FC<EditBookingModalProps> = ({ booking, onClose }) => {
    const { refresh } = useBookingsContext();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [availableTimes, setAvailableTimes] = useState<Record<string, boolean>>({});
    const [fetchingAvailability, setFetchingAvailability] = useState(false);
    const [countrySearch, setCountrySearch] = useState('');

    const parsedPhone = useMemo(() => parsePhone(booking?.phone ?? undefined), [booking]);

    const [selectedCountry, setSelectedCountry] = useState(parsedPhone.country);
    const [phoneValue, setPhoneValue] = useState(parsedPhone.local);

    const [formData, setFormData] = useState({
        name: booking?.name ?? '',
        email: booking?.email ?? '',
        size: booking?.size ?? 2,
        language: booking?.language ?? 'fr',
        lowTable: booking?.lowTable ?? false,
        date: booking ? dayjs(booking.startTime).tz(RESTAURANT_TZ).format('YYYY-MM-DD') : '',
        time: booking ? dayjs(booking.startTime).tz(RESTAURANT_TZ).format('HH:mm') : '19:00',
    });

    // Re-sync form when booking changes (modal re-opened for a different booking)
    useEffect(() => {
        if (!booking) return;
        const pp = parsePhone(booking.phone ?? undefined);
        setSelectedCountry(pp.country);
        setPhoneValue(pp.local);
        setFormData({
            name: booking.name,
            email: booking.email ?? '',
            size: booking.size,
            language: booking.language ?? 'fr',
            lowTable: booking.lowTable,
            date: dayjs(booking.startTime).tz(RESTAURANT_TZ).format('YYYY-MM-DD'),
            time: dayjs(booking.startTime).tz(RESTAURANT_TZ).format('HH:mm'),
        });
        setError('');
    }, [booking]);

    const filteredCountries = useMemo(() => {
        const s = countrySearch.toLowerCase().trim();
        if (!s) return COUNTRIES;
        return COUNTRIES.filter(c =>
            c.name.toLowerCase().includes(s) ||
            c.dial.includes(s) ||
            c.code.toLowerCase().includes(s)
        );
    }, [countrySearch]);

    // Fetch daily availability when date or size changes
    useEffect(() => {
        if (!booking || !formData.date || !formData.size) return;
        const fetchDaily = async () => {
            setFetchingAvailability(true);
            try {
                const data = await api.getDailyAvailability(formData.date, formData.size);
                const map: Record<string, boolean> = {};
                data.forEach(item => { map[item.time] = item.available; });
                setAvailableTimes(map);
            } catch (e) {
                console.error('Failed to fetch daily availability', e);
            } finally {
                setFetchingAvailability(false);
            }
        };
        fetchDaily();
    }, [formData.date, formData.size, booking]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!booking) return;

        const sanitizedName = formData.name.trim().substring(0, 20);
        if (sanitizedName.length < 2) {
            setError('Name must be at least 2 characters');
            return;
        }

        const sanitizedEmail = formData.email.trim().toLowerCase().substring(0, 24);
        if (sanitizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
            setError('Invalid email format');
            return;
        }

        const fullPhone = phoneValue ? `${selectedCountry.dial}${phoneValue.replace(/\s/g, '')}` : '';
        const sanitizedPhone = fullPhone.substring(0, 20);

        setLoading(true);
        setError('');
        try {
            await api.updateBooking(booking.id, {
                name: sanitizedName,
                phone: sanitizedPhone || null,
                email: sanitizedEmail || null,
                size: formData.size,
                language: formData.language,
                lowTable: formData.lowTable,
                startTime: `${formData.date} ${formData.time}`,
            });
            await refresh();
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to update reservation');
        } finally {
            setLoading(false);
        }
    };

    const isOpen = booking !== null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[100] bg-slate-950/40 backdrop-blur-md flex items-center justify-center p-4 transition-colors"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 z-[101] flex items-start justify-center p-2 sm:p-4 pointer-events-none overflow-y-auto pt-6 sm:pt-12 md:pt-20"
                    >
                        <div
                            className="w-full max-w-md md:max-w-2xl bg-white rounded-3xl sm:rounded-4xl shadow-2xl border border-slate-100 mb-8 overflow-visible pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-5 sm:p-8">
                                <div className="flex justify-between items-center mb-4 sm:mb-8">
                                    <div>
                                        <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                            <Pencil className="w-5 h-5 text-indigo-500" />
                                            Edit Reservation
                                        </h2>
                                        <p className="text-sm font-medium text-slate-400">Modify guest details or timing</p>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Left Column: Guest Info */}
                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Guest details</label>
                                                <div className="space-y-3">
                                                    <div className="relative group">
                                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                                                            <User className="w-4 h-4" />
                                                        </div>
                                                        <input
                                                            autoFocus
                                                            required
                                                            type="text"
                                                            maxLength={20}
                                                            placeholder="Guest Name"
                                                            value={formData.name}
                                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 sm:py-4 pl-12 pr-4 font-bold text-slate-900 focus:border-indigo-500/50 focus:bg-white outline-none transition-all"
                                                        />
                                                    </div>
                                                    <div className="relative group flex gap-2">
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <button
                                                                    type="button"
                                                                    className="flex items-center gap-2 bg-slate-50 border-2 border-slate-100 rounded-2xl px-3 hover:bg-white hover:border-indigo-500/50 transition-all cursor-pointer h-[52px] sm:h-[60px]"
                                                                >
                                                                    <span className="text-lg">{selectedCountry.flag}</span>
                                                                    <span className="text-xs font-bold text-slate-500">{selectedCountry.dial}</span>
                                                                    <ChevronDown className="w-3 h-3 text-slate-300" />
                                                                </button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-68 p-0 bg-white border-slate-100 shadow-2xl rounded-2xl z-110 overflow-hidden" align="start">
                                                                <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                                                                    <div className="relative group/search">
                                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within/search:text-indigo-500 transition-colors" />
                                                                        <input
                                                                            autoFocus
                                                                            type="text"
                                                                            placeholder="Search country..."
                                                                            value={countrySearch}
                                                                            onChange={e => setCountrySearch(e.target.value)}
                                                                            className="w-full bg-white border-2 border-slate-100 rounded-xl py-2 pl-9 pr-3 text-xs font-bold text-slate-700 focus:border-indigo-500/30 outline-none transition-all"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-1 gap-1 max-h-60 overflow-y-auto p-2 scrollbar-thin">
                                                                    {filteredCountries.length > 0 ? (
                                                                        filteredCountries.map(c => (
                                                                            <button
                                                                                key={c.code}
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setSelectedCountry(c);
                                                                                    setCountrySearch('');
                                                                                }}
                                                                                className={cn(
                                                                                    "flex items-center gap-3 w-full p-2.5 rounded-xl text-left transition-all hover:bg-slate-50",
                                                                                    selectedCountry.code === c.code && "bg-indigo-50/50 text-indigo-700"
                                                                                )}
                                                                            >
                                                                                <span className="text-xl">{c.flag}</span>
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-xs font-bold">{c.name}</span>
                                                                                    <span className="text-[10px] text-slate-400 font-medium">{c.dial}</span>
                                                                                </div>
                                                                            </button>
                                                                        ))
                                                                    ) : (
                                                                        <div className="p-8 text-center">
                                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No matching country</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </PopoverContent>
                                                        </Popover>

                                                        <div className="relative flex-1 group/phone">
                                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/phone:text-indigo-500 transition-colors">
                                                                <Phone className="w-4 h-4" />
                                                            </div>
                                                            <input
                                                                type="tel"
                                                                maxLength={15}
                                                                placeholder="Phone Number (Optional)"
                                                                value={phoneValue}
                                                                onChange={e => setPhoneValue(e.target.value.replace(/[^\d\s]/g, ''))}
                                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 sm:py-4 pl-12 pr-4 font-bold text-slate-900 focus:border-indigo-500/50 focus:bg-white outline-none transition-all"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="relative group">
                                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                                                            <Mail className="w-4 h-4" />
                                                        </div>
                                                        <input
                                                            type="email"
                                                            maxLength={24}
                                                            placeholder="Email Address (Optional)"
                                                            value={formData.email}
                                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 sm:py-4 pl-12 pr-4 font-bold text-slate-900 focus:border-indigo-500/50 focus:bg-white outline-none transition-all"
                                                        />
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {[
                                                            { code: 'fr', flag: '🇫🇷', label: 'Fr' },
                                                            { code: 'en', flag: '🇬🇧', label: 'En' },
                                                            { code: 'it', flag: '🇮🇹', label: 'It' },
                                                        ].map(l => (
                                                            <button
                                                                key={l.code}
                                                                type="button"
                                                                className={
                                                                    formData.language === l.code
                                                                        ? 'px-3 py-1.5 rounded-lg border-2 font-bold text-[10px] uppercase flex items-center gap-1.5 bg-indigo-50 border-indigo-600 text-indigo-700 cursor-pointer transition-all'
                                                                        : 'px-3 py-1.5 rounded-lg border-2 font-bold text-[10px] uppercase flex items-center gap-1.5 bg-white border-slate-100 text-slate-400 hover:border-slate-200 cursor-pointer transition-all'
                                                                }
                                                                onClick={() => setFormData({ ...formData, language: l.code })}
                                                            >
                                                                <span>{l.flag}</span> {l.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Column: Date, Time, Size, Low Table */}
                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Date & Time</label>
                                                <div className="space-y-3">
                                                    <DatePicker
                                                        date={dayjs(formData.date).toDate()}
                                                        setDate={d => setFormData({ ...formData, date: dayjs(d).format('YYYY-MM-DD') })}
                                                        disabled={(date) => dayjs(date).isBefore(dayjs(), 'day')}
                                                    />

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1.5">
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Guests</label>
                                                            <div className="relative group">
                                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">
                                                                    <Users className="w-4 h-4" />
                                                                </div>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    value={formData.size}
                                                                    onChange={e => setFormData({ ...formData, size: parseInt(e.target.value) || 1 })}
                                                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 sm:py-4 pl-12 pr-4 font-bold text-slate-900 focus:border-indigo-500/50 focus:bg-white outline-none transition-all"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Time</label>
                                                            <div className="relative group">
                                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">
                                                                    <Clock className="w-4 h-4" />
                                                                </div>
                                                                <select
                                                                    value={formData.time}
                                                                    onChange={e => setFormData({ ...formData, time: e.target.value })}
                                                                    className={`w-full bg-slate-50 border-2 rounded-2xl py-3 sm:py-4 pl-12 pr-4 font-bold text-slate-900 focus:bg-white outline-none transition-all appearance-none ${
                                                                        !fetchingAvailability && availableTimes[formData.time] === false
                                                                            ? 'border-red-100 text-red-900'
                                                                            : 'border-slate-100 focus:border-indigo-500/50'
                                                                    }`}
                                                                >
                                                                    {TIME_SLOTS.map(t => {
                                                                        const isFull = !fetchingAvailability && availableTimes[t] === false;
                                                                        return (
                                                                            <option key={t} value={t}>
                                                                                {t} {isFull ? '(Full)' : ''}
                                                                            </option>
                                                                        );
                                                                    })}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Low Table Toggle */}
                                            <div
                                                className={cn(
                                                    "p-4 border-2 rounded-3xl group transition-all cursor-pointer select-none",
                                                    formData.lowTable
                                                        ? "bg-indigo-50 border-indigo-200"
                                                        : "bg-indigo-50/30 border-slate-100 hover:bg-white hover:border-indigo-500/30"
                                                )}
                                                onClick={() => setFormData(prev => ({ ...prev, lowTable: !prev.lowTable }))}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-sm text-lg",
                                                        formData.lowTable ? "bg-indigo-600 text-white" : "bg-white text-slate-300 border border-slate-100"
                                                    )}>
                                                        🪑
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Low Table</div>
                                                        <div className="text-[9px] text-slate-400 font-bold">Accessible seating preference</div>
                                                    </div>
                                                    <div className={cn(
                                                        "w-12 h-6 rounded-full relative transition-all duration-300",
                                                        formData.lowTable ? "bg-indigo-600" : "bg-slate-200"
                                                    )}>
                                                        <div className={cn(
                                                            "absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all duration-500 shadow-md",
                                                            formData.lowTable ? "left-6.5" : "left-0.5"
                                                        )} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <AnimatePresence>
                                        {error && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                                                exit={{ opacity: 0, height: 0, scale: 0.95 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="p-3 bg-red-50 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-xl border border-red-100/50 flex items-center gap-2">
                                                    <div className="w-1 h-1 bg-red-500 rounded-full animate-pulse" />
                                                    {error}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className="pt-4">
                                        <button
                                            disabled={loading}
                                            type="submit"
                                            className="w-full bg-slate-900 text-white rounded-2xl py-4 sm:py-5 font-black flex items-center justify-center gap-2 hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200 hover:shadow-indigo-500/20 disabled:opacity-50 active:scale-[0.98] cursor-pointer group"
                                        >
                                            {loading ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : (
                                                <>
                                                    Save Changes
                                                    <Check className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
