import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Users, Clock, Check, Loader2, Mail, Bell, MailCheck, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { DatePicker } from './ui/date-picker';
import { COUNTRIES } from '../utils/countries';
import { cn } from '../lib/utils';
import { useBookingsContext } from '../context/useBookingsContext';
import dayjs, { RESTAURANT_TZ } from '../utils/dayjs';
import { CountryPhonePicker } from './booking/CountryPhonePicker';
import {
    TIME_SLOTS,
    LANGUAGES,
    sanitizeName,
    sanitizeEmail,
    buildPhone,
    validateBookingFields,
} from '../utils/bookingValidation';

interface AdminQuickReservationProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: string;
    onSuccess?: (date: string) => void;
}

export const AdminQuickReservation: React.FC<AdminQuickReservationProps> = ({
    isOpen,
    onClose,
    selectedDate,
    onSuccess
}) => {
const getFirstAvailableTime = (date: string) => {
    return TIME_SLOTS.find(slot => dayjs.tz(`${date} ${slot}`, RESTAURANT_TZ).isAfter(dayjs().tz(RESTAURANT_TZ))) || null;
};



    const { bookings, refresh } = useBookingsContext();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        size: 2,
        language: 'fr',
        date: selectedDate,
        time: '19:00',
        notify: true,
    });

    const [availableTimes, setAvailableTimes] = useState<Record<string, boolean>>({});

    const currentOccupancyRate = useMemo(() => {
        const dailyBookings = bookings.filter(b => 
            dayjs(b.startTime).tz(RESTAURANT_TZ).format('YYYY-MM-DD') === formData.date && 
            b.status !== 'CANCELLED'
        );
        const occupied = new Set(
            dailyBookings.flatMap(b => b.tables?.map(t => t.name) || [])
        ).size;
        return (occupied / 36) * 100;
    }, [bookings, formData.date]);
    const [fetchingAvailability, setFetchingAvailability] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
    const [phoneValue, setPhoneValue] = useState('');

    React.useEffect(() => {
        const fetchDaily = async () => {
            if (!formData.date || !formData.size) return;
            setFetchingAvailability(true);
            try {
                const data = await api.getDailyAvailability(formData.date, formData.size);
                const map: Record<string, boolean> = {};
                data.forEach(item => {
                    map[item.time] = item.available;
                });
                setAvailableTimes(map);
            } catch (e) {
                console.error('Failed to fetch daily availability', e);
            } finally {
                setFetchingAvailability(false);
            }
        };
        if (isOpen) fetchDaily();
    }, [formData.date, formData.size, isOpen]);

    // Keep date in sync with selectedDate prop when dialog opens
    React.useEffect(() => {
        if (isOpen) {
            setFormData(f => ({ ...f, date: selectedDate }));
        }
    }, [isOpen, selectedDate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Sanitize & validate using shared rules
        const sanitizedName = sanitizeName(formData.name);
        const sanitizedEmail = sanitizeEmail(formData.email);
        const sanitizedPhone = buildPhone(selectedCountry.dial, phoneValue);

        const validationError = validateBookingFields({ name: formData.name, email: formData.email });
        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);
        setError('');

        try {
            await api.createBooking({
                name: sanitizedName,
                phone: sanitizedPhone,
                email: sanitizedEmail,
                size: formData.size,
                language: formData.language,
                startTime: formData.date + ' ' + formData.time,
                notify: formData.notify,
            } as any);
            
            await refresh(); // Force refresh of context data before proceeding
            
            if (onSuccess) onSuccess(formData.date);
            onClose();
            // Reset form
            setFormData({
                name: '',
                phone: '',
                email: '',
                size: 2,
                time: '19:00',
                language: 'fr',
                date: selectedDate,
                notify: true,
            });
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message || 'Failed to create reservation');
            } else {
                setError('Failed to create reservation');
            }
        } finally {
            setLoading(false);
        }
    };

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
                                        Quick Res
                                        {currentOccupancyRate >= 70 && (
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 text-amber-600 rounded-lg animate-pulse border border-amber-100">
                                                <AlertTriangle className="w-3.5 h-3.5" />
                                                <span className="text-[10px] font-black uppercase tracking-wider">{Math.round(currentOccupancyRate)}%</span>
                                            </div>
                                        )}
                                    </h2>
                                    <p className="text-sm font-medium text-slate-400">Add reservation manually</p>
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
                                    {/* Left Column: Basic Info */}
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
                                                <CountryPhonePicker
                                                    selectedCountry={selectedCountry}
                                                    onCountryChange={setSelectedCountry}
                                                    phoneValue={phoneValue}
                                                    onPhoneChange={setPhoneValue}
                                                />
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
                                                    {LANGUAGES.map(l => (
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

                                    {/* Right Column: DateTime and Options */}
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Date & Time</label>
                                            <div className="space-y-3">
                                                <DatePicker 
                                                    date={dayjs(formData.date).toDate()} 
                                                    setDate={d => {
                                                        const nextDate = dayjs(d).format('YYYY-MM-DD');
                                                        const nextTime = dayjs(`${nextDate} ${formData.time}`).isBefore(dayjs()) 
                                                            ? getFirstAvailableTime(nextDate)
                                                            : formData.time;
                                                        setFormData({...formData, date: nextDate, time: nextTime || ''});
                                                    }}
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
                                                        <div className="flex justify-between items-center ml-1">
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Time</label>
                                                        </div>
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

                                        <div className="p-4 bg-indigo-50/30 border-2 border-slate-100 rounded-3xl group transition-all hover:bg-white hover:border-indigo-500/30">
                                            <div className="flex items-center gap-4">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-sm",
                                                    formData.notify ? "bg-indigo-600 text-white" : "bg-white text-slate-300 border border-slate-100"
                                                )}>
                                                    {formData.notify ? <Bell className="w-4 h-4" /> : <MailCheck className="w-4 h-4" />}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Notifications</div>
                                                    <div className="text-[9px] text-slate-400 font-bold">Automated confirmation</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, notify: !prev.notify }))}
                                                    className={cn(
                                                        "w-12 h-6 rounded-full relative transition-all duration-300",
                                                        formData.notify ? "bg-emerald-500" : "bg-slate-200"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all duration-500 shadow-md",
                                                        formData.notify ? "left-6.5" : "left-0.5"
                                                    )} />
                                                </button>
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
                                                Create Reservation 
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
