import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { cn } from '../lib/utils';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import 'dayjs/locale/en';
import { Turnstile } from '@marsidev/react-turnstile';
import { api } from '../services/api';
import { DatePicker } from './ui/date-picker';
import type { Lang } from '../i18n/translations';
import { useLanguage } from '../i18n/useLanguage';

const TURNSTILE_SITE_KEY = '1x00000000000000000000AA'; // Standard Testing Key (use env in prod)
const TIME_SLOTS = ['16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'];

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
    lowTable: false,
  });

  // Harden: Pattern-based validation with strict length limits
  const validation = useMemo(() => {
    const name = formData.name.trim();
    const phone = formData.phone.trim();
    const email = formData.email.trim();
    
    return {
      email: email.length > 0 && email.length <= 24 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      phone: phone.length >= 8 && phone.length <= 20 && /^\+?[\d\s-]{8,}$/.test(phone),
      name: name.length >= 2 && name.length <= 20,
      isStep3Valid: name.length >= 2 && name.length <= 20 &&
        email.length <= 24 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
        phone.length >= 8 && phone.length <= 20 && /^\+?[\d\s-]{8,}$/.test(phone)
    };
  }, [formData.name, formData.email, formData.phone]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [availableTimes, setAvailableTimes] = useState<Record<string, boolean>>({});
  const [fetchingAvailability, setFetchingAvailability] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchDaily = async () => {
      if (!formData.date || !formData.size) return;
      setFetchingAvailability(true);
      try {
        const data = await api.getDailyAvailability(formData.date, formData.size);
        if (!isMounted) return;
        const map: Record<string, boolean> = {};
        data.forEach(item => {
          map[item.time] = item.available;
        });
        setAvailableTimes(map);
      } catch (e) {
        console.error('Failed to fetch daily availability', e);
      } finally {
        if (isMounted) setFetchingAvailability(false);
      }
    };
    fetchDaily();
    return () => { isMounted = false; };
  }, [formData.date, formData.size]);

  const nextStep = useCallback((next: number) => {
    setDirection(1);
    setStep(next);
  }, []);

  const prevStep = useCallback((prev: number) => {
    setDirection(-1);
    setStep(prev);
  }, []);

  const handleCheckAvailability = async () => {
    setLoading(true);
    setError('');
    setSuggestions([]);
    try {
      const data = await api.checkAvailability(formData.date, formData.startTime || '', formData.size);
      if (data.available) {
        nextStep(3);
      } else {
        setSuggestions(data.suggestions || []);
        setError(t.no_tables);
      }
    } catch (err) {
      setError(t.error);
      console.error('[Booking Handoff Error]:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBook = async () => {
    if (!validation.isStep3Valid) {
      setError('Please fill all required fields correctly');
      return;
    }
    if (!token) {
      setError('Please complete the verification');
      return;
    }
    setLoading(true);
    try {
      const startTime = formData.startTime
        ? dayjs(`${formData.date} ${formData.startTime}`).toISOString()
        : '';
      
      // Strict Sanitization before API call
      const payload = {
        ...formData,
        name: formData.name.trim().substring(0, 20),
        phone: formData.phone.trim().substring(0, 20),
        email: formData.email.trim().toLowerCase().substring(0, 24),
        startTime,
        notify: true,
      };

      await api.createBooking(payload as any);
      nextStep(4);
    } catch (e: any) {
      setError(e.message || t.error);
      console.error('[Booking Execution Error]:', e);
    } finally {
      setLoading(false);
    }
  };

  // Optimize: Memoize motion variants
  const slideVariants = useMemo(() => ({
    enter: (direction: number) => ({
      x: direction > 0 ? 50 : -50,
      opacity: 0,
      scale: 0.98,
      filter: 'blur(10px)'
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
      filter: 'blur(0px)'
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 50 : -50,
      opacity: 0,
      scale: 0.98,
      filter: 'blur(10px)'
    })
  }), []);

  return (
    <div className="w-full max-w-md mx-auto px-4 perspective-1000">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative group box-glow"
      >
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-emerald-500/20 rounded-[3rem] blur-xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>

        <div className="relative bg-white/90 backdrop-blur-3xl rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] border border-white/50 overflow-hidden flex flex-col">

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
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className="space-y-8"
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                      <span>{t.step1}</span>
                      <span className="text-indigo-600 font-black">{formData.size} guests</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          min="1"
                          max="60"
                          value={formData.size}
                          onChange={e => setFormData({ ...formData, size: parseInt(e.target.value) || 1 })}
                          className="w-full bg-slate-50/50 border-2 border-slate-100 hover:border-indigo-100 rounded-3xl p-6 text-5xl font-black text-center text-slate-900 focus:border-indigo-500/30 focus:bg-white focus:shadow-xl focus:shadow-indigo-500/5 transition-all outline-none"
                        />
                      </div>
                      <button
                        onClick={() => nextStep(2)}
                        disabled={formData.size < 1 || formData.size > 60}
                        className="bg-slate-900 text-white p-6 rounded-3xl font-black hover:bg-indigo-600 disabled:opacity-20 transition-all shadow-xl active:scale-95 group/btn h-20 aspect-square flex items-center justify-center cursor-pointer overflow-hidden relative"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                        <ArrowRight className="w-8 h-8 group-hover/btn:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[2, 4, 6, 8, 10, 12, 15, 20].map(s => (
                      <button
                        key={s}
                        onClick={() => setFormData({ ...formData, size: s })}
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
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className="space-y-6"
                >
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block pl-1">{t.date}</label>
                      <div className="relative group/date">
                        <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within/date:text-indigo-500 transition-colors z-10 pointer-events-none" />
                        <DatePicker
                          date={dayjs(formData.date).toDate()}
                          setDate={d => {
                            const nextDate = dayjs(d).format('YYYY-MM-DD');
                            const nextTime = dayjs(`${nextDate} ${formData.startTime}`).isBefore(dayjs())
                              ? getFirstAvailableTime(nextDate)
                              : formData.startTime;
                            setFormData({ ...formData, date: nextDate, startTime: nextTime || '' });
                          }}
                          disabled={(date) => dayjs(date).isBefore(dayjs(), 'day')}
                          className="pl-12 h-14 bg-white/50 border-2 border-slate-100 rounded-2xl font-bold text-sm focus:border-indigo-500/30 transition-all shadow-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center pl-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block">{t.time}</label>
                        {fetchingAvailability && <div className="h-1 w-12 bg-indigo-500/20 rounded-full overflow-hidden relative"><div className="absolute inset-0 bg-indigo-500 animate-slide" /></div>}
                      </div>

                      {!getFirstAvailableTime(formData.date) && dayjs(formData.date).isSame(dayjs(), 'day') ? (
                        <div className="p-8 bg-red-50/30 border-2 border-dashed border-red-100 rounded-3xl text-center">
                          <p className="text-sm font-bold text-red-600">{t.no_slots}</p>
                          <p className="text-[10px] text-red-400 mt-1 uppercase font-black tracking-widest">No more service for today</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {TIME_SLOTS.map(t => {
                            const isPassed = dayjs(`${formData.date} ${t}`).isBefore(dayjs());
                            const isAvailable = availableTimes[t] !== false;
                            const isDisabled = isPassed || (!fetchingAvailability && !isAvailable);

                            return (
                              <button
                                key={t}
                                type="button"
                                disabled={isDisabled}
                                onClick={() => setFormData({ ...formData, startTime: t })}
                                className={clsx(
                                  "py-3 rounded-2xl border-2 font-black transition-all text-xs relative cursor-pointer active:scale-95",
                                  formData.startTime === t
                                    ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200"
                                    : isDisabled
                                      ? "bg-slate-50/50 border-slate-50 text-slate-300 opacity-40 cursor-not-allowed select-none"
                                      : "bg-white border-slate-100 text-slate-600 hover:border-indigo-500/30 hover:bg-slate-50"
                                )}
                              >
                                {t}
                                {!fetchingAvailability && !isAvailable && !isPassed && (
                                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white shadow-sm"></div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      <div className="bg-red-50/50 text-red-600 p-4 rounded-2xl border-2 border-red-100/50 flex items-center gap-3 text-[11px] font-bold">
                        <ShieldCheck className="w-5 h-5 opacity-40" />
                        {error}
                      </div>

                      {suggestions.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">{t.suggested_slots}</p>
                          <div className="grid grid-cols-3 gap-2">
                            {suggestions.map(s => (
                              <button
                                key={s}
                                onClick={() => {
                                  setFormData({ ...formData, startTime: s });
                                  setSuggestions([]);
                                  setError('');
                                  setTimeout(() => handleCheckAvailability(), 0);
                                }}
                                className="py-3 rounded-2xl border-2 border-indigo-100/50 bg-indigo-50/30 text-indigo-600 font-black text-xs hover:bg-indigo-50 transition-all cursor-pointer active:scale-95 shadow-sm shadow-indigo-500/5"
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => prevStep(1)}
                      className="flex-1 bg-slate-50 text-slate-400 p-4 rounded-2xl font-black hover:bg-slate-100 transition-all flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest group cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> {t.back}
                    </button>
                    <button
                      onClick={handleCheckAvailability}
                      disabled={loading || fetchingAvailability || !formData.startTime || dayjs(`${formData.date} ${formData.startTime}`).isBefore(dayjs()) || (availableTimes[formData.startTime] === false)}
                      className="flex-2 bg-slate-900 text-white p-4 rounded-2xl font-black hover:bg-indigo-600 disabled:opacity-20 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 text-xs cursor-pointer relative overflow-hidden group/btn"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                      {loading || fetchingAvailability ? <div className="loading-dots italic">{t.checking || 'Checking...'}</div> : <>{t.check} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>}
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className="space-y-4"
                >
                  <div className="space-y-3">
                    <div className="space-y-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-1">{t.step3}</div>

                    <div className="space-y-3">
                      <div className="relative group/field">
                        <input
                          type="text"
                          required
                          maxLength={20}
                          value={formData.name}
                          onChange={e => setFormData({ ...formData, name: e.target.value })}
                          placeholder={`${t.name} *`}
                          className={cn(
                            "w-full bg-slate-50/50 border-2 rounded-2xl p-4 text-slate-900 font-bold focus:bg-white transition-all outline-none text-sm pl-11",
                            formData.name && !validation.name ? "border-red-100 bg-red-50/20" : "border-slate-100 focus:border-indigo-500/30"
                          )}
                        />
                        <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within/field:text-indigo-500 transition-colors" />
                      </div>

                      <div className="relative group/field">
                        <input
                          type="tel"
                          required
                          maxLength={20}
                          value={formData.phone}
                          onChange={e => setFormData({ ...formData, phone: e.target.value })}
                          placeholder={`${t.phone} *`}
                          className={cn(
                            "w-full bg-slate-50/50 border-2 rounded-2xl p-4 text-slate-900 font-bold focus:bg-white transition-all outline-none text-sm pl-11",
                            formData.phone && !validation.phone ? "border-red-100 bg-red-50/20" : "border-slate-100 focus:border-indigo-500/30"
                          )}
                        />
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within/field:text-indigo-500 transition-colors" />
                      </div>

                      <div className="relative group/field">
                        <input
                          type="email"
                          required
                          maxLength={24}
                          value={formData.email}
                          onChange={e => setFormData({ ...formData, email: e.target.value })}
                          placeholder={`${t.email} *`}
                          className={cn(
                            "w-full bg-slate-50/50 border-2 rounded-2xl p-4 text-slate-900 font-bold focus:bg-white transition-all outline-none text-sm pl-11",
                            formData.email && !validation.email ? "border-red-100 bg-red-50/20" : "border-slate-100 focus:border-indigo-500/30"
                          )}
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within/field:text-indigo-500 transition-colors flex items-center justify-center font-black text-xs">@</div>
                      </div>

                                       <button
                        type="button"
                        className={cn(
                          "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer",
                          formData.lowTable ? "bg-indigo-50/80 border-indigo-200" : "border-slate-100 hover:bg-white"
                        )}
                        onClick={() => setFormData({ ...formData, lowTable: !formData.lowTable })}
                      >
                        <div className={clsx("w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all", formData.lowTable ? "bg-indigo-600 border-indigo-600 shadow-md shadow-indigo-200" : "border-slate-200 bg-white")}>
                          <motion.div animate={{ scale: formData.lowTable ? 1 : 0 }}>
                            <Check className="w-4 h-4 text-white" />
                          </motion.div>
                        </div>
                        <span className={cn("text-xs font-black uppercase tracking-widest", formData.lowTable ? "text-indigo-700" : "text-slate-500")}>{t.low_table}</span>
                      </button>

                      <div className="flex gap-2 mt-2">
                        {[
                          { code: 'fr', flag: '🇫🇷', label: 'FR' },
                          { code: 'en', flag: '🇬🇧', label: 'EN' },
                          { code: 'it', flag: '🇮🇹', label: 'IT' },
                        ].map(l => (
                          <button
                            key={l.code}
                            type="button"
                            className={clsx(
                              'flex-1 py-2.5 rounded-xl border-2 font-black text-[10px] flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95',
                              formData.language === l.code ? 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-sm shadow-indigo-100' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                            )}
                            onClick={() => setFormData({ ...formData, language: l.code as Lang })}
                          >
                            <span className="text-xs">{l.flag}</span> {l.label}
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

                  <AnimatePresence>
                    {error && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0, scale: 0.95 }} 
                        animate={{ opacity: 1, height: 'auto', scale: 1 }} 
                        exit={{ opacity: 0, height: 0, scale: 0.95 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-red-50/50 p-3 rounded-xl border-2 border-red-100/30 text-red-500 text-[10px] font-black uppercase tracking-widest text-center flex items-center justify-center gap-2">
                          <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                          {error}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => prevStep(2)}
                      className="flex-1 bg-slate-50 text-slate-400 p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all cursor-pointer"
                    >
                      {t.back}
                    </button>
                    <button
                      onClick={handleBook}
                      disabled={loading || !validation.isStep3Valid || !token}
                      className="flex-2 bg-emerald-600 text-white p-4 rounded-2xl font-black hover:bg-emerald-500 disabled:opacity-20 transition-all shadow-xl shadow-emerald-500/10 text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 relative overflow-hidden group"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      {loading ? `${t.processing}...` : <>{t.book} <Check className="w-4 h-4 group-hover:scale-110 transition-transform" /></>}
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ scale: 0.9, opacity: 0, filter: 'blur(10px)' }}
                  animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
                  transition={{ type: "spring", damping: 20, stiffness: 200 }}
                  className="text-center space-y-8 py-6"
                >
                  <div className="relative inline-block">
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

                    <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 shadow-[0_20px_40px_-10px_rgba(16,185,129,0.4)] border-4 border-white">
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
                      className="text-4xl font-black text-slate-900 tracking-tighter"
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
                      <p className="text-[11px] text-slate-400 font-medium flex items-center justify-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                        {t.success_msg.split('!')[1]}
                      </p>
                    </motion.div>
                  </div>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mx-auto max-w-[340px] bg-white/50 backdrop-blur-sm rounded-[2rem] p-6 border-2 border-slate-50 shadow-sm relative overflow-hidden"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-white rounded-2xl shadow-sm flex items-center justify-center border border-slate-100 text-2xl">
                          {(() => {
                            const l = formData.language;
                            if (l === 'fr') return '🇫🇷';
                            if (l === 'en') return '🇬🇧';
                            if (l === 'it') return '🇮🇹';
                            return '🏳️';
                          })()}
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] leading-none mb-1.5">Language</p>
                          <p className="capitalize text-sm font-bold text-slate-800 truncate">
                            {(() => {
                              const l = formData.language;
                              if (l === 'fr') return 'Français';
                              if (l === 'en') return 'English';
                              if (l === 'it') return 'Italiano';
                              return l;
                            })()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] leading-none mb-1.5">{t.guests}</p>
                          <p className="text-sm font-black text-indigo-600">{formData.size} guests</p>
                        </div>
                      </div>

                      <div className="h-px bg-slate-100"></div>

                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-white rounded-2xl shadow-sm flex items-center justify-center border border-slate-100">
                          <CalendarIcon className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] leading-none mb-1.5">{t.res_info}</p>
                          <p className="capitalize text-sm font-bold text-slate-800 truncate">
                            {dayjs(formData.date).format('dddd, DD MMM')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] leading-none mb-1.5">Time</p>
                          <p className="text-sm font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">{formData.startTime}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    onClick={() => { setStep(1); setFormData({ ...formData, name: '', phone: '', email: '', lowTable: false }); setToken(null); }}
                    className="inline-flex items-center gap-2 text-slate-400 hover:text-indigo-600 transition-colors font-black text-[10px] uppercase tracking-[0.25em] cursor-pointer"
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
