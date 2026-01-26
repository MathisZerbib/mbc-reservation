import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';

interface Booking {
  id: string;
  tableId: number;
  startTime: string;
  endTime: string;
  guestName: string;
  size: number;
  guestPhone: string;
  table: { name: string };
}

export const Agenda: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));

  useEffect(() => {
    fetch('http://localhost:3000/api/bookings')
      .then(res => res.json())
      .then((data: Booking[]) => {
        const sorted = data.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        setBookings(sorted);
      });
  }, []);

  const filteredBookings = bookings.filter(b => dayjs(b.startTime).format('YYYY-MM-DD') === date);

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden h-full flex flex-col">
      <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
         <h2 className="text-xl font-bold text-slate-900">Agenda</h2>
         <input 
           type="date" 
           value={date} 
           onChange={e => setDate(e.target.value)}
           className="border-slate-200 rounded-lg p-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-slate-900 outline-none"
         />
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredBookings.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
             <p>No bookings for this date.</p>
          </div>
        ) : (
          filteredBookings.map(b => (
            <div key={b.id} className="group bg-white border border-slate-100 rounded-xl p-4 hover:shadow-md transition-shadow relative overflow-hidden">
               <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-200 group-hover:bg-slate-900 transition-colors"></div>
               <div className="flex justify-between items-start pl-3">
                 <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-900">{dayjs(b.startTime).format('HH:mm')}</span>
                        <span className="text-slate-400 text-xs">to</span>
                        <span className="font-bold text-slate-500">{dayjs(b.endTime).format('HH:mm')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                         <span className="text-sm font-semibold text-slate-800">{b.guestName}</span>
                         <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">{b.size}p</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">{b.guestPhone}</div>
                 </div>
                 <div className="text-right">
                     <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded block mb-2">Table {b.table?.name}</span>
                     <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                            className="p-1.5 rounded hover:bg-green-100 text-green-600 transition-colors"
                            title="Check-in"
                            onClick={() => alert(`Check-in ${b.guestName}`)}
                        >
                            Checking
                        </button>
                        <button 
                            className="p-1.5 rounded hover:bg-red-100 text-red-600 transition-colors"
                            title="Cancel"
                            onClick={() => alert(`Cancel ${b.guestName}`)}
                        >
                            Cancel
                        </button>
                     </div>
                 </div>
               </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
