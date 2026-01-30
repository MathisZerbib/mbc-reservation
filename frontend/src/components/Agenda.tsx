import React, { useState } from 'react';
import dayjs from 'dayjs';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { useBookings } from '../hooks/useBookings';
import { api } from '../services/api';
import { DatePicker } from './ui/date-picker';

interface AgendaProps {
  setHoveredBookingId: (id: string | null) => void;
  date: string;
  setDate: (date: string) => void;
}

export const Agenda: React.FC<AgendaProps> = ({ setHoveredBookingId, date, setDate }) => {
  const { bookings, refresh } = useBookings();
  const [showModal, setShowModal] = useState<{ id: string, name: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCheckIn = async (id: string) => {
    try {
        setLoading(true);
        await api.checkIn(id);
        refresh();
    } catch (e) {
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
        alert('Cancellation failed');
    } finally {
        setLoading(false);
    }
  };

  const filteredBookings = bookings.filter(b => dayjs(b.startTime).format('YYYY-MM-DD') === date);

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden h-full flex flex-col relative">
      <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
         <h2 className="text-xl font-bold text-slate-900 mr-4">Agenda</h2>
         <DatePicker 
           date={dayjs(date).toDate()} 
           setDate={d => setDate(dayjs(d).format('YYYY-MM-DD'))}
           className="h-10 text-xs font-bold"
         />
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
                  "group bg-white border rounded-xl p-4 hover:shadow-xl transition-all duration-300 relative overflow-hidden cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
                  b.status === 'CANCELLED' ? "opacity-50 grayscale border-slate-100" : "border-slate-100 hover:border-indigo-200"
                )}
            >
               <div className={clsx(
                   "absolute left-0 top-0 bottom-0 w-1 transition-colors",
                   b.status === 'COMPLETED' ? "bg-emerald-500" : 
                   b.status === 'CANCELLED' ? "bg-slate-300" : "bg-slate-200 group-hover:bg-slate-900"
               )}></div>
               <div className="flex justify-between items-start pl-3">
                 <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-900">{dayjs(b.startTime).format('HH:mm')}</span>
                        <span className="text-slate-400 text-xs">to</span>
                        <span className="font-bold text-slate-500">{dayjs(b.endTime).format('HH:mm')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                         <span className="text-sm font-semibold text-slate-800">{b.name}</span>
                         <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">{b.size}p</span>
                         {b.status === 'COMPLETED' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">{b.phone}</div>
                 </div>
                  <div className="text-right">
                     {b.status === 'CANCELLED' ? (
                         <span className="text-[10px] font-black uppercase text-slate-400">Cancelled</span>
                     ) : b.tables.length > 0 ? (
                       <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded block mb-2">
                          {b.tables.map(t => t.name).join(' + ')}
                       </span>
                     ) : (
                       <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded block mb-2 border border-red-100">
                          Unassigned
                       </span>
                     )}
                     
                     {b.status !== 'CANCELLED' && b.status !== 'COMPLETED' && (
                         <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                            <button 
                                className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600 transition-colors flex items-center gap-1 text-[10px] font-bold"
                                title="Check-in"
                                onClick={() => handleCheckIn(b.id)}
                                disabled={loading}
                            >
                                <CheckCircle2 className="w-3 h-3" /> Check-in
                            </button>
                            <button 
                                className="p-1.5 rounded hover:bg-red-50 text-red-600 transition-colors flex items-center gap-1 text-[10px] font-bold"
                                title="Cancel"
                                onClick={() => setShowModal({ id: b.id, name: b.name })}
                                disabled={loading}
                            >
                                <XCircle className="w-3 h-3" /> Cancel
                            </button>
                         </div>
                     )}
                 </div>
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
                        className="flex-1 px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                      >
                          Stay
                      </button>
                      <button 
                        onClick={handleCancel}
                        disabled={loading}
                        className="flex-1 px-4 py-2 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all active:scale-95 disabled:opacity-50"
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
