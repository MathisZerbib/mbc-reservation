import React, { useState } from 'react';
import { Check } from 'lucide-react';
import clsx from 'clsx';
import dayjs from 'dayjs';

// ... imports
import { TRANSLATIONS, type Lang } from '../i18n/translations';

export const BookingWidget: React.FC = () => {
  const [lang, setLang] = useState<Lang>('fr');
  const t = TRANSLATIONS[lang];
  const [step, setStep] = useState(1);
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

  const handleCheckAvailability = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`http://localhost:3000/api/availability?date=${formData.date}&time=${formData.time}&size=${formData.size}`);
      const data = await res.json();
      if (data.available) {
        setStep(3);
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
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setStep(4);
      } else {
        const d = await res.json();
        setError(d.error || t.error);
      }
    } catch (e) {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <label className="block text-sm font-semibold text-slate-700 uppercase tracking-wider">{t.step1}</label>
      <div className="grid grid-cols-4 gap-3">
        {[2, 4, 5, 6, 7, 8, 10].map(s => (
          <button
            key={s}
            onClick={() => { setFormData({...formData, size: s}); setStep(2); }}
            className={clsx(
              "p-4 rounded-xl flex items-center justify-center border-2 transition-all duration-200 text-lg font-bold shadow-sm hover:shadow-md",
              formData.size === s 
                ? "bg-slate-900 text-white border-slate-900 scale-105" 
                : "bg-white text-slate-700 border-slate-200 hover:border-slate-900 hover:text-slate-900"
            )}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center gap-2">
        <span className="text-xl">ℹ️</span>
        Groups 6+ get 3 hours. Standard is 2 hours.
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
           <label className="block text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">{t.date}</label>
           <input 
             type="date" 
             value={formData.date}
             onChange={e => setFormData({...formData, date: e.target.value})}
             className="block w-full border-slate-200 rounded-xl shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all font-medium"
           />
        </div>
        <div>
           <label className="block text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">{t.time}</label>
           <div className="relative">
             <select 
               value={formData.time}
               onChange={e => setFormData({...formData, time: e.target.value})}
               className="block w-full border-slate-200 rounded-xl shadow-sm p-3 bg-slate-50 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all font-medium appearance-none"
             >
               {['17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00'].map(time => (
                 <option key={time} value={time}>{time}</option>
               ))}
             </select>
             <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
               ▼
             </div>
           </div>
        </div>
      </div>
      {error && <div className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-lg">{error}</div>}
      <div className="flex justify-between items-center pt-6">
        <button onClick={() => setStep(1)} className="text-slate-500 hover:text-slate-800 font-medium transition-colors">{t.back}</button>
        <button 
          onClick={handleCheckAvailability}
          disabled={loading}
          className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-xl disabled:opacity-50 font-bold shadow-lg shadow-slate-900/20 transform transition-all active:scale-95"
        >
          {loading ? 'Checking...' : t.check}
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <label className="block text-sm font-semibold text-slate-700 uppercase tracking-wider mb-1">{t.name}</label>
        <input 
          type="text" 
          value={formData.name}
          onChange={e => setFormData({...formData, name: e.target.value})}
          className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all"
          placeholder="John Doe"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 uppercase tracking-wider mb-1">{t.phone}</label>
        <input 
          type="tel" 
          value={formData.phone}
          onChange={e => setFormData({...formData, phone: e.target.value})}
          className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all"
          placeholder="+33 6 12 34 56 78"
        />
      </div>
       <div>
        <label className="block text-sm font-semibold text-slate-700 uppercase tracking-wider mb-1">{t.email}</label>
        <input 
          type="email" 
          value={formData.email}
          onChange={e => setFormData({...formData, email: e.target.value})}
          className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all"
          placeholder="john@example.com"
        />
      </div>
       {error && <div className="text-red-500 text-sm">{error}</div>}
       <div className="flex justify-between items-center pt-4">
        <button onClick={() => setStep(2)} className="text-slate-500 hover:text-slate-800 font-medium transition-colors">{t.back}</button>
        <button 
          onClick={handleBook}
          disabled={loading || !formData.name || !formData.phone}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-xl disabled:opacity-50 font-bold shadow-lg shadow-emerald-600/20 transform transition-all active:scale-95"
        >
          {loading ? 'Booking...' : t.book}
        </button>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="text-center py-12 animate-in fade-in zoom-in duration-500">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 mb-6">
        <Check className="h-10 w-10 text-emerald-600" />
      </div>
      <h3 className="text-2xl font-bold text-slate-900">{t.success_title}</h3>
      <p className="mt-2 text-slate-500">{t.success_msg}</p>
      <div className="mt-8 p-4 bg-slate-50 rounded-xl inline-block border border-slate-100">
          <div className="text-sm text-slate-400 uppercase tracking-widest font-bold">Reservation</div>
          <div className="text-lg font-bold text-slate-800 mt-1">{formData.date} @ {formData.time}</div>
          <div className="text-slate-600">{formData.size} People</div>
      </div>
      
      <button 
        onClick={() => { setStep(1); setFormData({...formData, name: '', phone: '', email: ''}); }}
        className="block w-full mt-8 text-indigo-600 hover:text-indigo-500 font-medium hover:underline"
      >
        Make another booking
      </button>
    </div>
  );

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        <div className="bg-slate-900 p-6 flex justify-between items-center">
            <h2 className="text-xl font-bold text-white tracking-wide">{t.title}</h2>
            <div className="flex bg-slate-800 rounded-lg p-1">
                <button onClick={() => setLang('en')} className={clsx("px-3 py-1 rounded-md text-xs font-bold transition-all", lang === 'en' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-white")}>EN</button>
                <button onClick={() => setLang('fr')} className={clsx("px-3 py-1 rounded-md text-xs font-bold transition-all", lang === 'fr' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-white")}>FR</button>
            </div>
        </div>

        <div className="p-8">
            {/* Progress Bar (Optional) */}
            <div className="flex gap-2 mb-8">
                <div className={clsx("h-1 flex-1 rounded-full transition-all", step >= 1 ? "bg-slate-900" : "bg-slate-100")}></div>
                <div className={clsx("h-1 flex-1 rounded-full transition-all", step >= 2 ? "bg-slate-900" : "bg-slate-100")}></div>
                <div className={clsx("h-1 flex-1 rounded-full transition-all", step >= 3 ? "bg-slate-900" : "bg-slate-100")}></div>
            </div>

            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
        </div>
      </div>
    </div>
  );
};
