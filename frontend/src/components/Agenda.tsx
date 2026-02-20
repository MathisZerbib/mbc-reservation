import React, { useState } from 'react';
import dayjs from 'dayjs';
import { CheckCircle2, XCircle, AlertTriangle, Search, Users } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../services/api';
import { DatePicker } from './ui/date-picker';
import { calculateAffluence, affluenceClassNames, formatTableLabels } from '../utils/bookingUtils';
import { useBookingsContext } from '../context/useBookingsContext';
interface AgendaProps {
  setHoveredBookingId: (id: string | null) => void;
  date: string;
  setDate: (date: string) => void;
}

export const Agenda: React.FC<AgendaProps> = ({ setHoveredBookingId, date, setDate }) => {
  const { bookings, refresh } = useBookingsContext();
  const [showModal, setShowModal] = useState<{ id: string, name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [searchSize, setSearchSize] = useState<string>('');

  const handleCheckIn = async (id: string) => {
    try {
        setLoading(true);
        await api.checkIn(id);
        refresh();
    } catch (e) {
      console.error(e);
        alert('Check-in failed');
    } finally {
        setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!showModal) return;
    try {
        setLoading(true);
        await api.cancelBooking(showModal.id);
        refresh();
        setShowModal(null);
    } catch (e) {
      console.error(e);
        alert('Cancellation failed');
    } finally {
        setLoading(false);
    }
  };

  const filteredBookings = bookings
    .filter(b => dayjs(b.startTime).format('YYYY-MM-DD') === date)
    .filter(b => {
      // Name or Table match
      if (searchName) {
        const s = searchName.toLowerCase();
        const guestMatch = b.name.toLowerCase().includes(s);
        const tableMatch = b.tables?.some(t => t.name.toLowerCase().includes(s));
        if (!guestMatch && !tableMatch) return false;
      }
      
      // Exact Size match
      if (searchSize) {
        if (b.size !== parseInt(searchSize)) return false;
      }

      return true;
    });

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden h-full flex flex-col relative">
      <div className="p-6 border-b border-slate-100 bg-slate-50 space-y-4">
        <div className="flex justify-between items-center">
           <h2 className="text-xl font-bold text-slate-900">Agenda</h2>
           <DatePicker 
             date={dayjs(date).toDate()} 
             setDate={d => setDate(dayjs(d).format('YYYY-MM-DD'))}
             className="h-10 text-xs font-bold cursor-pointer"
             modifiers={calculateAffluence(bookings)}
             modifiersClassNames={affluenceClassNames}
           />
        </div>
        
        <div className="flex gap-2">
            <div className="relative group flex-1">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none" />
               <input 
                 type="text"
                 placeholder="Search name or table..."
                 value={searchName}
                 onChange={e => setSearchName(e.target.value)}
                 className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/50 transition-all placeholder:text-slate-400 shadow-sm"
               />
               {searchName && (
                 <button 
                   onClick={() => setSearchName('')}
                   className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                 >
                   <XCircle className="w-3 h-3 text-slate-300 hover:text-slate-500" />
                 </button>
               )}
            </div>

            <div className="relative group w-20">
               <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none" />
               <input 
                 type="number"
                 placeholder="Size"
                 value={searchSize}
                 onChange={e => setSearchSize(e.target.value)}
                 className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-2 text-xs font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/50 transition-all placeholder:text-slate-400 shadow-sm appearance-none"
               />
            </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredBookings.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
             <p>No bookings for this date.</p>
          </div>
        ) : (
          filteredBookings.map(b => (
            <div key={b.id} 
                onMouseEnter={() => setHoveredBookingId(b.id)}
                onMouseLeave={() => setHoveredBookingId(null)}
                className={clsx(
                  "group bg-white border rounded-[2rem] p-6 hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] transition-all duration-500 relative overflow-hidden cursor-pointer",
                  b.status === 'CANCELLED' ? "opacity-60 grayscale border-slate-100" : "border-slate-100 hover:border-indigo-200"
                )}
            >
               <div className={clsx(
                   "absolute left-0 top-0 bottom-0 w-1.5 transition-all duration-500",
                   b.status === 'COMPLETED' ? "bg-emerald-400" : 
                   b.status === 'CANCELLED' ? "bg-slate-200" : "bg-slate-100 group-hover:bg-indigo-500"
               )}></div>
               
               <div className="flex justify-between items-start gap-4">
                 <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-2">
                        <div className="bg-slate-900 text-white px-2.5 py-1 rounded-lg text-xs font-black tracking-tight">
                            {dayjs(b.startTime).format('HH:mm')}
                        </div>
                        <div className="w-4 h-px bg-slate-200"></div>
                        <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                            {dayjs(b.endTime).format('HH:mm')}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                         <h3 className="text-base font-black text-slate-900 tracking-tight">{b.name}</h3>
                         <div className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[10px] font-black">
                            <Users className="w-3 h-3" />
                            {b.size}
                         </div>
                         {b.highTable && (
                            <div className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md border border-indigo-100 uppercase tracking-wider">
                                High
                            </div>
                         )}
                         {b.status === 'COMPLETED' && (
                            <div className="bg-emerald-50 text-emerald-600 p-1 rounded-full border border-emerald-100">
                                <CheckCircle2 className="w-3 h-3" />
                            </div>
                         )}
                    </div>
                    
                    {b.phone && (
                        <p className="text-[11px] text-slate-400 font-medium mt-2 flex items-center gap-1.5 opacity-80">
                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                            {b.phone}
                        </p>
                    )}
                 </div>

                  <div className="flex flex-col justify-between items-end shrink-0 min-h-[130px] ml-4">
                     {/* Top Right: Status/Tables - Clearly separated */}
                     <div className="flex flex-col items-end gap-2 pr-10">
                        {b.status === 'CANCELLED' ? (
                            <div className="px-3 py-1 bg-slate-100 rounded-full text-[9px] font-black uppercase tracking-widest text-slate-400">
                                Cancelled
                            </div>
                        ) : b.tables.length > 0 ? (
                            <div className="flex flex-wrap justify-end gap-1.5 max-w-[200px]">
                                {formatTableLabels(b.tables).map((label, idx) => (
                                    <span key={idx} className="text-[10px] font-black text-emerald-700 bg-emerald-50/80 border border-emerald-100 px-2 py-1 rounded-md whitespace-nowrap shadow-sm">
                                        {label}
                                    </span>
                                ))}
                            </div>
                        ) : b.status !== 'COMPLETED' && (
                            <div className="px-3 py-1 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[9px] font-black animate-pulse uppercase tracking-wider shadow-sm shadow-red-100">
                                Unassigned
                            </div>
                        )}
                     </div>

                     {/* Bottom Right: Primary Action - Even more bottom-right */}
                     <div className="-mb-2 -mr-3">
                        {b.status === 'COMPLETED' ? (
                            <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100 shadow-sm">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">Completed</span>
                            </div>
                        ) : b.status !== 'CANCELLED' && (
                            <button 
                                className="h-10 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white transition-all duration-300 flex items-center gap-2 text-xs font-black cursor-pointer shadow-xl shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                                onClick={(e) => { e.stopPropagation(); handleCheckIn(b.id); }}
                                disabled={loading}
                            >
                                <CheckCircle2 className="w-4 h-4" /> Check-in
                            </button>
                        )}
                     </div>
                  </div>

                  {/* Absolute Cancel Cross: Fixed positioning to avoid overlap */}
                  {b.status !== 'CANCELLED' && b.status !== 'COMPLETED' && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); setShowModal({ id: b.id, name: b.name }); }}
                        className="absolute top-3.5 right-3.5 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer opacity-0 group-hover:opacity-100 border border-transparent hover:border-red-100"
                        title="Cancel Reservation"
                    >
                        <XCircle className="w-4 h-4" />
                    </button>
                  )}
               </div>
            </div>
          ))
        )}
      </div>

      {/* Confirmation Modal */}
      {showModal && (
          <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-xs w-full animate-in zoom-in duration-200">
                  <div className="flex items-center gap-4 mb-4 text-red-600">
                      <div className="bg-red-50 p-2 rounded-xl">
                          <AlertTriangle className="w-6 h-6" />
                      </div>
                      <h3 className="font-bold text-lg">Cancel Booking?</h3>
                  </div>
                  <p className="text-sm text-slate-500 mb-6">
                      Are you sure you want to cancel the reservation for <span className="font-bold text-slate-900">{showModal.name}</span>? This action cannot be undone.
                  </p>
                  <div className="flex gap-3">
                      <button 
                        onClick={() => setShowModal(null)}
                        className="flex-1 px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                          Stay
                      </button>
                      <button 
                        onClick={handleCancel}
                        disabled={loading}
                        className="flex-1 px-4 py-2 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                          {loading ? '...' : 'Confirm'}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
