import React, { useState } from 'react';
import dayjs from 'dayjs';
import { CheckCircle2, XCircle, AlertTriangle, Search, Users } from 'lucide-react';
import clsx from 'clsx';
import { cn } from '../lib/utils';
import { api } from '../services/api';
import { DatePicker } from './ui/date-picker';
import { calculateAffluence, affluenceClassNames, formatTableLabels } from '../utils/bookingUtils';
import { useBookingsContext } from '../context/useBookingsContext';
interface AgendaProps {
  setHoveredBookingId: (id: string | null) => void;
  date: string;
  setDate: (date: string) => void;
  className?: string;
}

export const Agenda: React.FC<AgendaProps> = ({ setHoveredBookingId, date, setDate, className }) => {
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
    <div className={cn("bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden h-full flex flex-col relative", className)}>
      {/* Header Section */}
      <div className="p-5 pb-4 flex-none space-y-4 bg-gradient-to-b from-slate-50/50 to-white border-b border-slate-100/50">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.25em] pl-0.5">Schedule</span>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">{dayjs(date).format('dddd, D MMM')}</p>
          </div>
          <DatePicker
            date={dayjs(date).toDate()}
            setDate={d => setDate(dayjs(d).format('YYYY-MM-DD'))}
            className="h-10 text-[10px] font-black cursor-pointer bg-white border-2 border-slate-100 hover:border-indigo-500/30 hover:shadow-md transition-all rounded-xl px-4 w-full sm:w-auto min-w-0"
            modifiers={calculateAffluence(bookings)}
            modifiersClassNames={affluenceClassNames}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 group-focus-within:text-indigo-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search name or table..."
              value={searchName}
              onChange={e => setSearchName(e.target.value)}
              className="w-full bg-white border-2 border-slate-50/80 rounded-xl py-2 pl-8 pr-8 text-[11px] font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/30 transition-all placeholder:text-slate-300 shadow-sm"
            />
            {searchName && (
              <button onClick={() => setSearchName('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-50 rounded-lg text-slate-200 hover:text-slate-400 transition-colors">
                <XCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="relative group">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 group-focus-within:text-indigo-400 pointer-events-none" />
            <input
              type="number"
              placeholder="Filter by size..."
              value={searchSize}
              onChange={e => setSearchSize(e.target.value)}
              className="w-full bg-white border-2 border-slate-50/80 rounded-xl py-2 pl-8 pr-1 text-[11px] font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/30 transition-all placeholder:text-slate-300 shadow-sm"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pt-4 space-y-3 bg-slate-50/20">
        {filteredBookings.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border-2 border-dashed border-slate-200">
              <Search className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">No matching bookings</p>
            <p className="text-[11px] text-slate-500 font-medium mt-1">Try adjusting your filters for this date.</p>
          </div>
        ) : (
          filteredBookings.map(b => (
            <div key={b.id}
              onMouseEnter={() => setHoveredBookingId(b.id)}
              onMouseLeave={() => setHoveredBookingId(null)}
              className={clsx(
                "group bg-white border rounded-[1.5rem] p-4 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] transition-all duration-500 relative overflow-hidden cursor-pointer",
                b.status === 'CANCELLED' ? "opacity-60 grayscale border-slate-100" : "border-slate-100 hover:border-indigo-200 active:scale-[0.99]"
              )}
            >
              <div className={clsx(
                "absolute left-0 top-0 bottom-0 w-1.5 transition-all duration-500",
                b.status === 'COMPLETED' ? "bg-emerald-400" :
                  b.status === 'CANCELLED' ? "bg-slate-200" : "bg-slate-100 group-hover:bg-indigo-500"
              )}></div>

              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="bg-slate-900 text-white px-2 py-0.5 rounded-md text-[10px] font-black tracking-tighter">
                      {dayjs(b.startTime).format('HH:mm')}
                    </div>
                    <div className="text-slate-400 text-[9px] font-bold uppercase tracking-widest opacity-60">
                      {dayjs(b.endTime).format('HH:mm')}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 min-w-0">
                    <h3 className="text-sm font-black text-slate-900 tracking-tight truncate">
                      {b.language === 'fr' ? '🇫🇷 ' : b.language === 'en' ? '🇬🇧 ' : b.language === 'it' ? '🇮🇹 ' : ''}
                      {b.name}
                    </h3>
                    <div className="flex-shrink-0 flex items-center gap-1 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-full text-[9px] font-black">
                      <Users className="w-2.5 h-2.5" />
                      {b.size}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {b.lowTable && (
                      <div className="text-[8px] font-black bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-md border border-indigo-100 uppercase tracking-tighter">
                        Low
                      </div>
                    )}
                    {b.phone && (
                      <span className="text-[9px] text-slate-400 font-medium whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-1 opacity-70 min-w-0 max-w-[140px]">
                        <span className="w-1 h-1 rounded-full bg-slate-200 flex-shrink-0"></span>
                        <span className="truncate">{b.phone}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col justify-between items-end shrink-0 ml-auto self-stretch pr-4">
                  {/* Top Right: Status/Tables */}
                  <div className="flex flex-col items-end gap-1 mb-2">
                    {b.status === 'CANCELLED' ? (
                      <div className="px-2 py-0.5 bg-slate-100 rounded-lg text-[8px] font-black uppercase tracking-widest text-slate-400">
                        Cancel
                      </div>
                    ) : b.tables.length > 0 ? (
                      <div className="flex flex-wrap justify-end gap-1 max-w-[120px]">
                        {formatTableLabels(b.tables).map((label, idx) => (
                          <span key={idx} className="text-[8px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                            {label}
                          </span>
                        ))}
                      </div>
                    ) : b.status !== 'COMPLETED' && (
                      <div className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded text-[8px] font-black animate-pulse uppercase tracking-wider">
                        Map?
                      </div>
                    )}
                  </div>

                  {/* Bottom Right: Primary Action */}
                  <div className="-mb-1 -mr-1">
                    {b.status === 'COMPLETED' ? (
                      <div className="flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        <span className="text-[8px] font-black text-emerald-600 uppercase">OK</span>
                      </div>
                    ) : b.status !== 'CANCELLED' && (
                      <button
                        className="h-8 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-all flex items-center gap-1 text-[9px] font-black cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                        onClick={(e) => { e.stopPropagation(); handleCheckIn(b.id); }}
                        disabled={loading}
                      >
                        <CheckCircle2 className="w-3 h-3" /> Check-in
                      </button>
                    )}
                  </div>
                </div>

                {/* Absolute Cancel Cross */}
                {b.status !== 'CANCELLED' && b.status !== 'COMPLETED' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowModal({ id: b.id, name: b.name }); }}
                    className="absolute top-1.5 right-1.5 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer opacity-0 group-hover:opacity-100 z-10"
                    title="Cancel Reservation"
                  >
                    <XCircle className="w-3.5 h-3.5" />
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
