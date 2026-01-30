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
import 'dayjs/locale/fr';
import 'dayjs/locale/en';
import { Turnstile } from '@marsidev/react-turnstile';
import { api } from '../services/api';
import { DatePicker } from './ui/date-picker';
import type { Lang } from '../i18n/translations';
import { useLanguage } from '../i18n/useLanguage';

const TURNSTILE_SITE_KEY = '1x00000000000000000000AA'; // Standard Testing Key (use env in prod)
const TIME_SLOTS = ['17:00','18:30','19:00','20:00','21:00','22:00'];

export const BookingWidget: React.FC = () => {
    const { lang, setLang, t } = useLanguage();
    dayjs.locale(lang);
    
    const getFirstAvailableTime = (date: string) => {
        const now = dayjs();
        return TIME_SLOTS.find(slot => dayjs(`${date} ${slot}`).isAfter(now)) || null;
    };
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [formData, setFormData] = useState({
    size: 2,
    date: dayjs().format('YYYY-MM-DD'),
    startTime: getFirstAvailableTime(dayjs().format('YYYY-MM-DD')),
    language: lang || 'fr',
    name: '',
    phone: '',
    email: '',
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
      const data = await api.checkAvailability(formData.date, formData.startTime || '', formData.size);
      if (data.available) {
        nextStep(3);
      } else {
        setError(t.no_tables);
      }
    } catch {
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
      const startTime = formData.startTime
        ? dayjs(`${formData.date} ${formData.startTime}`).toISOString()
        : '';
      await api.createBooking({
        ...formData,
        startTime,
      });
      nextStep(4);
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'message' in e && typeof (e as { message?: unknown }).message === 'string') {
        setError((e as { message: string }).message);
      } else {
        setError(t.error);
      }
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
        <div className="absolute -inset-1 bg-linear-to-r from-indigo-500 to-emerald-500 rounded-4xl blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
        
        <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 overflow-hidden flex flex-col">
          
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
            
            <div className="flex bg-slate-100 p-1 rounded-full border border-slate-200 shadow-inner scale-90 sm:scale-100">
                <button 
                  onClick={() => setLang('en')} 
                  className={clsx(
                    "px-3 h-8 rounded-full text-[10px] font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer", 
                    lang === 'en' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  <span className="text-xs">🇬🇧</span> EN
                </button>
                <button 
                  onClick={() => setLang('fr')} 
                  className={clsx(
                    "px-3 h-8 rounded-full text-[10px] font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer", 
                    lang === 'fr' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  <span className="text-xs">🇫🇷</span> FR
                </button>
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
          <div className="flex-1 p-5 sm:p-6 pt-4 relative overflow-hidden min-h-100 sm:min-h-110">
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
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-3xl sm:text-4xl font-black text-center text-slate-900 focus:border-indigo-500/50 focus:bg-white transition-all outline-none"
                            />
                        </div>
                        <button 
                            onClick={() => nextStep(2)}
                            disabled={formData.size < 1 || formData.size > 60}
                            className="bg-slate-900 text-white p-5 rounded-2xl font-black hover:bg-indigo-600 disabled:opacity-30 transition-all shadow-lg hover:shadow-indigo-500/20 group/btn h-18 aspect-square flex items-center justify-center cursor-pointer"
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
                       {t.booking_info}
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
                                setDate={d => {
                                    const nextDate = dayjs(d).format('YYYY-MM-DD');
                                    const nextTime = dayjs(`${nextDate} ${formData.startTime}`).isBefore(dayjs()) 
                                        ? getFirstAvailableTime(nextDate)
                                        : formData.startTime;
                                    setFormData({...formData, date: nextDate, startTime: nextTime || ''});
                                }}
                                disabled={(date) => dayjs(date).isBefore(dayjs(), 'day')}
                                className="pl-10"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">{t.time}</label>
                        {!getFirstAvailableTime(formData.date) && dayjs(formData.date).isSame(dayjs(), 'day') ? (
                            <div className="p-4 bg-red-50/50 border border-red-100 rounded-2xl text-center">
                                <p className="text-xs font-bold text-red-600">{t.no_slots}</p>
                            </div>
                        ) : dayjs(formData.date).isBefore(dayjs(), 'day') ? (
                            <div className="p-4 bg-red-50/50 border border-red-100 rounded-2xl text-center">
                                <p className="text-xs font-bold text-red-600">{t.date_passed}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {TIME_SLOTS.map(t => {
                                    const isPassed = dayjs(`${formData.date} ${t}`).isBefore(dayjs());
                                    return (
                                        <button
                                            key={t}
                                            type="button"
                                            disabled={isPassed}
                                            onClick={() => setFormData({...formData, startTime: t})}
                                            className={clsx(
                                                "py-2.5 rounded-xl border-2 font-black transition-all text-sm cursor-pointer",
                                                formData.startTime === t 
                                                    ? "bg-indigo-600 border-indigo-600 text-white" 
                                                    : isPassed
                                                        ? "bg-slate-50 border-transparent text-slate-300 opacity-40 cursor-not-allowed"
                                                        : "bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100"
                                            )}
                                        >
                                            {t}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
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
                        className="flex-1 bg-slate-100 text-slate-600 p-4 rounded-2xl font-black hover:bg-slate-200 transition-all flex items-center justify-center gap-1.5 text-xs group cursor-pointer"
                    >
                        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> {t.back}
                    </button>
                    <button 
                        onClick={handleCheckAvailability}
                        disabled={loading || !formData.startTime || dayjs(`${formData.date} ${formData.startTime}`).isBefore(dayjs())}
                        className="flex-2 bg-slate-900 text-white p-4 rounded-2xl font-black hover:bg-indigo-600 disabled:opacity-50 transition-all shadow-md hover:shadow-indigo-500/20 flex items-center justify-center gap-2 text-xs cursor-pointer"
                    >
                        {loading ? <div className="loading-dots italic">{t.checking}</div> : <>{t.check} <ArrowRight className="w-4 h-4" /></>}
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
                    <div className="space-y-2 text-[10px] font-black uppercase tracking-widest text-slate-400">{t.step3}</div>
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
                              className={clsx(
                                'px-2 py-1 rounded-lg border-2 font-bold text-xs flex items-center gap-1',
                                formData.language === l.code ? 'bg-indigo-50 border-indigo-600 text-indigo-700' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                              )}
                              onClick={() => setFormData({ ...formData, language: l.code as Lang })}
                            >
                              <span>{l.flag}</span> {l.label}
                            </button>
                          ))}
                        </div>
                    </div>

                    <div className="pt-2 flex justify-center scale-[0.85] sm:scale-100 origin-center sm:origin-left">
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
                        className="flex-2 bg-emerald-600 text-white p-4 rounded-2xl font-black hover:bg-emerald-500 disabled:opacity-50 transition-all shadow-md text-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                        {loading ? `${t.processing}...` : <>{t.book} <Check className="w-4 h-4" /></>}
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", damping: 20, stiffness: 300 }}
                  className="text-center space-y-8 py-6"
                >
                  <div className="relative inline-block">
                    {/* Concentric rings animation */}
                    <motion.div 
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1.5, opacity: 0 }}
                        transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
                        className="absolute inset-0 bg-emerald-500/20 rounded-full"
                    />
                    <motion.div 
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 2, opacity: 0 }}
                        transition={{ repeat: Infinity, duration: 2, ease: "easeOut", delay: 0.5 }}
                        className="absolute inset-0 bg-emerald-400/10 rounded-full"
                    />
                    
                    <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)] border-4 border-white">
                        <motion.div
                            initial={{ scale: 0, rotate: -20 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ 
                                delay: 0.2, 
                                type: "spring",
                                stiffness: 500,
                                damping: 15
                            }}
                        >
                            <Check className="h-10 w-10 text-white stroke-4" />
                        </motion.div>
                    </div>
                  </div>

                  <div className="space-y-3 px-6">
                    <motion.h3 
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-3xl font-black text-slate-900 tracking-tighter"
                    >
                        {t.success_title}
                    </motion.h3>
                    <motion.div
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="space-y-1"
                    >
                        <p className="text-sm text-slate-600 font-bold leading-tight">
                            {t.success_msg.split('!')[0]}!
                        </p>
                        <p className="text-[11px] text-slate-400 font-medium flex items-center justify-center gap-1.5">
                            <ShieldCheck className="w-3 h-3 text-emerald-500" />
                            {t.success_msg.split('!')[1]}
                        </p>
                    </motion.div>
                  </div>

                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mx-auto max-w-[320px] bg-slate-50/80 backdrop-blur-sm rounded-3xl p-5 border border-slate-100 shadow-sm relative overflow-hidden"
                  >
                      <div className="space-y-4">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 bg-white rounded-xl shadow-sm flex items-center justify-center border border-slate-100 italic text-2xl">
                                {(() => {
                                  const l = formData.language;
                                  if (l === 'fr') return '🇫🇷';
                                  if (l === 'en') return '🇬🇧';
                                  if (l === 'it') return '🇮🇹';
                                  if (l === 'es') return '🇪🇸';
                                  if (l === 'ru') return '🇷🇺';
                                  return '🏳️';
                                })()}
                            </div>
                            <div className="text-left">
                                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">Language</p>
                                <p className="capitalize text-sm font-black text-slate-800">
                                    {(() => {
                                      const l = formData.language;
                                      if (l === 'fr') return 'Français';
                                      if (l === 'en') return 'English';
                                      if (l === 'it') return 'Italiano';
                                      if (l === 'es') return 'Español';
                                      if (l === 'ru') return 'Русский';
                                      return l;
                                    })()}
                                </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="h-10 w-10 bg-white rounded-xl shadow-sm flex items-center justify-center border border-slate-100 italic">
                                <CalendarIcon className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div className="text-left">
                                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">{t.res_info}</p>
                                <p className="capitalize text-sm font-black text-slate-800">
                                    {dayjs(formData.date).format('dddd, DD MMM')}
                                </p>
                                <p className="text-xs font-bold text-indigo-600">{formData.startTime}</p>
                            </div>
                          </div>
                          <div className="h-px bg-slate-200/50"></div>
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 bg-white rounded-xl shadow-sm flex items-center justify-center border border-slate-100 italic">
                                <Users className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div className="text-left">
                                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">{t.guests}</p>
                                <p className="text-sm font-black text-slate-800">{formData.size} {t.persons}</p>
                            </div>
                          </div>
                      </div>
                  </motion.div>
                  
                  <motion.button 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    onClick={() => { setStep(1); setFormData({...formData, name: '', phone: '', email: ''}); setToken(null); }}
                    className="inline-flex items-center gap-2 text-slate-400 hover:text-indigo-600 transition-colors font-black text-[10px] uppercase tracking-[0.2em] cursor-pointer"
                  >
                    {t.new_res} <ArrowRight className="w-3 h-3" />
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="px-6 pb-6 text-center">
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.25em] flex items-center justify-center gap-1.5 leading-none">
                <ShieldCheck className="w-3 h-3 -translate-y-px" /> {t.secure_booking}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
