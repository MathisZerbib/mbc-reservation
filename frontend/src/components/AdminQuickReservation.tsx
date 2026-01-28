import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Phone, Users, Clock, Check, Loader2 } from 'lucide-react';
import { api } from '../services/api';

interface AdminQuickReservationProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: string;
    onSuccess?: () => void;
}

export const AdminQuickReservation: React.FC<AdminQuickReservationProps> = ({ 
    isOpen, 
    onClose, 
    selectedDate,
    onSuccess 
}) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        size: 2,
        time: '19:00',
        language: 'fr',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        try {
            await api.createBooking({
                ...formData,
                date: selectedDate,
                email: '',
            } as any);
            if (onSuccess) onSuccess();
            onClose();
            // Reset form
            setFormData({
                name: '',
                phone: '',
                size: 2,
                time: '19:00',
                language: 'fr',
            });
        } catch (err: any) {
            setError(err.message || 'Failed to create reservation');
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
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    />
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-4xl shadow-2xl z-51 overflow-hidden border border-slate-100"
                    >
                        <div className="p-8">
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Quick Res</h2>
                                    <p className="text-sm font-medium text-slate-400">Add reservation manually</p>
                                </div>
                                <button 
                                    onClick={onClose}
                                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-5">
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
                                                placeholder="Guest Name"
                                                value={formData.name}
                                                onChange={e => setFormData({...formData, name: e.target.value})}
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 font-bold text-slate-900 focus:border-indigo-500/50 focus:bg-white outline-none transition-all"
                                            />
                                        </div>
                                        <div className="relative group">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                                                <Phone className="w-4 h-4" />
                                            </div>
                                            <input 
                                                type="tel" 
                                                placeholder="Phone Number (Optional)"
                                                value={formData.phone}
                                                onChange={e => setFormData({...formData, phone: e.target.value})}
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 font-bold text-slate-900 focus:border-indigo-500/50 focus:bg-white outline-none transition-all"
                                            />
                                        </div>
                                        <div className="flex gap-2 mt-2">
                                          {[
                                            { code: 'fr', flag: '🇫🇷', label: 'Français' },
                                            { code: 'en', flag: '🇬🇧', label: 'English' },
                                            { code: 'it', flag: '🇮🇹', label: 'Italiano' },
                                            // { code: 'es', flag: '🇪🇸', label: 'Español' },
                                            // { code: 'ru', flag: '🇷🇺', label: 'Русский' },
                                          ].map(l => (
                                            <button
                                              key={l.code}
                                              type="button"
                                              className={
                                                formData.language === l.code
                                                  ? 'px-2 py-1 rounded-lg border-2 font-bold text-xs flex items-center gap-1 bg-indigo-50 border-indigo-600 text-indigo-700'
                                                  : 'px-2 py-1 rounded-lg border-2 font-bold text-xs flex items-center gap-1 bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                                              }
                                              onClick={() => setFormData({ ...formData, language: l.code })}
                                            >
                                              <span>{l.flag}</span> {l.label}
                                            </button>
                                          ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
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
                                                onChange={e => setFormData({...formData, size: parseInt(e.target.value) || 1})}
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 font-bold text-slate-900 focus:border-indigo-500/50 focus:bg-white outline-none transition-all"
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
                                                onChange={e => setFormData({...formData, time: e.target.value})}
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 font-bold text-slate-900 focus:border-indigo-500/50 focus:bg-white outline-none transition-all appearance-none"
                                            >
                                                {['17:00','18:00','18:30','19:00','19:30','20:00','20:30','21:00','22:00'].map(t => (
                                                    <option key={t} value={t}>{t}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {error && (
                                    <div className="p-3 bg-red-50 text-red-500 text-xs font-bold rounded-xl border border-red-100">
                                        {error}
                                    </div>
                                )}

                                <div className="pt-4">
                                    <button 
                                        disabled={loading}
                                        type="submit"
                                        className="w-full bg-slate-900 text-white rounded-2xl py-5 font-black flex items-center justify-center gap-2 hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200 hover:shadow-indigo-500/20 disabled:opacity-50 active:scale-[0.98]"
                                    >
                                        {loading ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>Create Reservation <Check className="w-5 h-5" /></>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
