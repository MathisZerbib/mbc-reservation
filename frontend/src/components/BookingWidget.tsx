import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, 
  Users, 
  Calendar as CalendarIcon, 
  Clock, 
  ChevronLeft, 
  ArrowRight,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Turnstile } from '@marsidev/react-turnstile';
import { api } from '../services/api';
import { TRANSLATIONS, type Lang } from '../i18n/translations';
import { DatePicker } from './ui/date-picker';

const TURNSTILE_SITE_KEY = '1x00000000000000000000AA'; // Standard Testing Key (use env in prod)

export const BookingWidget: React.FC = () => {
  const [lang, setLang] = useState<Lang>('fr');
  const t = TRANSLATIONS[lang];
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [formData, setFormData] = useState({
    size: 2,
    date: dayjs().format('YYYY-MM-DD'),
    time: '19:00',
    name: '',
    phone: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState<string | null>(null);

  const nextStep = (next: number) => {
    setDirection(1);
    setStep(next);
  };

  const prevStep = (prev: number) => {
    setDirection(-1);
    setStep(prev);
  };

  const handleCheckAvailability = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.checkAvailability(formData.date, formData.time, formData.size);
      if (data.available) {
        nextStep(3);
      } else {
        setError(t.no_tables);
      }
    } catch (e) {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  };

  const handleBook = async () => {
    if (!token) {
        setError('Please complete the verification');
        return;
    }
    setLoading(true);
    try {
      await api.createBooking(formData);
      nextStep(4);
    } catch (e: any) {
      setError(e.message || t.error);
    } finally {
      setLoading(false);
    }
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 50 : -50,
      opacity: 0,
      scale: 0.98
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 50 : -50,
      opacity: 0,
      scale: 0.98
    })
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 perspective-1000">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative group box-glow"
      >
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-[2rem] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
        
        <div className="relative bg-white/95 backdrop-blur-xl rounded-[1.5rem] shadow-2xl border border-white/50 overflow-hidden flex flex-col">
          
          {/* Header */}
          <div className="p-6 pb-2 flex justify-between items-start">
            <div className="space-y-0.5">
                <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-1.5 text-indigo-600 font-bold tracking-widest text-[9px] uppercase"
                >
                    <Sparkles className="w-2.5 h-2.5" />
                    Premium Experience
                </motion.div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none">{t.title}</h2>
            </div>
            
            <div className="flex bg-slate-100 p-0.5 rounded-full border border-slate-200 shadow-inner scale-90">
                <button 
                  onClick={() => setLang('en')} 
                  className={clsx(
                    "w-7 h-7 rounded-full text-[9px] font-black transition-all flex items-center justify-center cursor-pointer", 
                    lang === 'en' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >EN</button>
                <button 
                  onClick={() => setLang('fr')} 
                  className={clsx(
                    "w-7 h-7 rounded-full text-[9px] font-black transition-all flex items-center justify-center cursor-pointer", 
                    lang === 'fr' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >FR</button>
            </div>
          </div>

          {/* Progress */}
          <div className="px-6 mt-2 flex gap-1 h-0.5">
            {[1, 2, 3].map(s => (
                <div 
                    key={s} 
                    className={clsx(
                        "flex-1 rounded-full transition-all duration-500",
                        step >= s ? "bg-indigo-600" : "bg-slate-100"
                    )}
                />
            ))}
          </div>

          {/* Main Content Area */}
          <div className="flex-1 p-6 pt-4 relative overflow-hidden min-h-[440px]">
            <AnimatePresence mode="wait" custom={direction}>
              {step === 1 && (
                <motion.div
                  key="step1"
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: "spring", damping: 30, stiffness: 250 }}
                  className="space-y-6"
                >
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">{t.step1}</label>
                    <div className="flex items-center gap-3">
                        <div className="relative group/input flex-1">
                            <input 
                                type="number"
                                min="1"
                                max="60"
                                value={formData.size}
                                onChange={e => setFormData({...formData, size: parseInt(e.target.value) || 1})}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-4xl font-black text-center text-slate-900 focus:border-indigo-500/50 focus:bg-white transition-all outline-none"
                            />
                        </div>
                        <button 
                            onClick={() => nextStep(2)}
                            disabled={formData.size < 1 || formData.size > 60}
                            className="bg-slate-900 text-white p-5 rounded-2xl font-black hover:bg-indigo-600 disabled:opacity-30 transition-all shadow-lg hover:shadow-indigo-500/20 group/btn h-[72px] aspect-square flex items-center justify-center cursor-pointer"
                        >
                            <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[2, 4, 6, 8, 10, 12, 15, 20].map(s => (
                        <button
                            key={s}
                            onClick={() => setFormData({...formData, size: s})}
                            className={clsx(
                                "py-3 rounded-xl border-2 font-black transition-all active:scale-95 text-sm cursor-pointer",
                                formData.size === s 
                                    ? "bg-indigo-50 border-indigo-600 text-indigo-700 shadow-sm shadow-indigo-100" 
                                    : "bg-white border-slate-50 text-slate-400 hover:border-slate-200"
                            )}
                        >
                            {s}
                        </button>
                    ))}
                  </div>

                  <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50 flex items-start gap-2.5">
                    <div className="p-1.5 bg-white rounded-lg shadow-sm shrink-0"><Clock className="w-3 h-3 text-indigo-600" /></div>
                    <p className="text-[10px] font-medium text-indigo-900/60 leading-relaxed">
                        Groups of 6+ get 3h allocation. Fine dining, redefined.
                    </p>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: "spring", damping: 30, stiffness: 250 }}
                  className="space-y-6"
                >
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">{t.date}</label>
                        <div className="relative">
                            <DatePicker 
                                date={dayjs(formData.date).toDate()} 
                                setDate={d => setFormData({...formData, date: dayjs(d).format('YYYY-MM-DD')})}
                                className="pl-10"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">{t.time}</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['17:00','18:30','19:00','20:00','21:00','22:00'].map(t => (
                                <button
                                    key={t}
                                    onClick={() => setFormData({...formData, time: t})}
                                    className={clsx(
                                        "py-2.5 rounded-xl border-2 font-black transition-all text-sm cursor-pointer",
                                        formData.time === t 
                                            ? "bg-indigo-600 border-indigo-600 text-white" 
                                            : "bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100"
                                    )}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-xl border border-red-100 flex items-center gap-2 text-[10px] font-bold">
                        <ShieldCheck className="w-4 h-4 opacity-50" />
                        {error}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button 
                        onClick={() => prevStep(1)} 
                        className="flex-1 bg-slate-100 text-slate-600 p-4 rounded-2xl font-black hover:bg-slate-200 transition-all flex items-center justify-center gap-1.5 text-xs group"
                    >
                        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> {t.back}
                    </button>
                    <button 
                        onClick={handleCheckAvailability}
                        disabled={loading}
                        className="flex-[2] bg-slate-900 text-white p-4 rounded-2xl font-black hover:bg-indigo-600 disabled:opacity-50 transition-all shadow-md hover:shadow-indigo-500/20 flex items-center justify-center gap-2 text-xs"
                    >
                        {loading ? <div className="loading-dots italic">Checking</div> : <>{t.check} <ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: "spring", damping: 30, stiffness: 250 }}
                  className="space-y-4"
                >
                  <div className="space-y-3">
                    <div className="space-y-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Personal Details</div>
                    <div className="space-y-2">
                        <input 
                            type="text" 
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                            placeholder={t.name}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3.5 text-slate-900 font-bold focus:border-indigo-500/50 transition-all outline-none text-sm"
                        />
                        <input 
                            type="tel" 
                            value={formData.phone}
                            onChange={e => setFormData({...formData, phone: e.target.value})}
                            placeholder={t.phone}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3.5 text-slate-900 font-bold focus:border-indigo-500/50 transition-all outline-none text-sm"
                        />
                        <input 
                            type="email" 
                            value={formData.email}
                            onChange={e => setFormData({...formData, email: e.target.value})}
                            placeholder={t.email}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3.5 text-slate-900 font-bold focus:border-indigo-500/50 transition-all outline-none text-sm"
                        />
                    </div>

                    <div className="pt-1 scale-[0.85] origin-left">
                        <Turnstile 
                            siteKey={TURNSTILE_SITE_KEY} 
                            onSuccess={setToken} 
                            className="w-full"
                        />
                    </div>
                  </div>

                  {error && <p className="text-red-500 text-[10px] font-bold text-center">{error}</p>}

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => prevStep(2)} className="flex-1 bg-slate-100 text-slate-600 p-4 rounded-2xl font-black text-xs cursor-pointer">{t.back}</button>
                    <button 
                        onClick={handleBook}
                        disabled={loading || !formData.name || !formData.phone || !token}
                        className="flex-[2] bg-emerald-600 text-white p-4 rounded-2xl font-black hover:bg-emerald-500 disabled:opacity-50 transition-all shadow-md text-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                        {loading ? 'Processing...' : <>{t.book} <Check className="w-4 h-4" /></>}
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", damping: 15 }}
                  className="text-center space-y-6 py-2"
                >
                  <div className="relative inline-block">
                    <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-10 animate-pulse"></div>
                    <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 border-2 border-emerald-500/10">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: "spring" }}
                        >
                            <Check className="h-8 w-8 text-emerald-600 stroke-[3]" />
                        </motion.div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{t.success_title}</h3>
                    <p className="text-xs text-slate-500 font-medium px-4">{t.success_msg}</p>
                  </div>

                  <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-3 max-w-[220px] mx-auto shadow-sm">
                      <div className="flex justify-center items-center gap-2">
                        <div className="p-1.5 bg-indigo-50 rounded-lg"><CalendarIcon className="w-4 h-4 text-indigo-600" /></div>
                        <div className="text-left font-black text-slate-800 leading-tight">
                            <div className="text-[8px] text-slate-400 uppercase tracking-widest">Date & Time</div>
                            <span className="text-xs">{dayjs(formData.date).format('DD MMM')} @ {formData.time}</span>
                        </div>
                      </div>
                      <div className="h-px bg-slate-200/40 mx-2"></div>
                      <div className="flex justify-center items-center gap-2">
                        <div className="p-1.5 bg-emerald-50 rounded-lg"><Users className="w-4 h-4 text-emerald-600" /></div>
                        <div className="text-left font-black text-slate-800 leading-tight">
                            <div className="text-[8px] text-slate-400 uppercase tracking-widest">Guest Count</div>
                            <span className="text-xs">{formData.size} Persons</span>
                        </div>
                      </div>
                  </div>
                  
                  <button 
                    onClick={() => { setStep(1); setFormData({...formData, name: '', phone: '', email: ''}); setToken(null); }}
                    className="text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:text-indigo-700 pt-2 block w-full cursor-pointer"
                  >
                    New Reservation
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="px-6 pb-4 text-center">
            <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.25em] flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-2.5 h-2.5" /> Secure Booking
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
