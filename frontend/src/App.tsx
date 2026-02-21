import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { FloorPlan } from './components/FloorPlan';
import { Agenda } from './components/Agenda';
import { Analytics } from './components/Analytics';
import { BookingPage } from './components/BookingPage';
import { TableAssignmentPage } from './components/TableAssignmentPage';
import { LanguageProvider } from './i18n/LanguageContext';

import { AdminQuickReservation } from './components/AdminQuickReservation';
import { LoginPage } from './components/LoginPage';
import { ProtectedRoutes } from './components/ProtectedRoutes';
import { BookingsProvider } from './context/BookingsContext';
import { useBookingsContext } from './context/useBookingsContext';
import { api } from './services/api';
import { Outlet } from 'react-router-dom';

const AutoConsecButton: React.FC<{ date: string }> = ({ date }) => {
  const { refresh } = useBookingsContext();
  const [loading, setLoading] = useState(false);

  const handleAutoConsec = async () => {
    if (!window.confirm(`Are you sure you want to trigger auto-consecutive bookings for ${date}?`)) return;
    
    setLoading(true);
    try {
      await api.autoConsec(date);
      refresh();
      alert('Auto-consecutive bookings created successfully!');
    } catch (error) {
      console.error('Auto-consec failure:', error);
      alert('Failed to create bookings: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleAutoConsec}
      disabled={loading}
      className="w-full bg-indigo-50 border border-indigo-100 text-indigo-700 px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-100 active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
    >
      {loading ? (
        <>
          <div className="w-3 h-3 border-2 border-indigo-700 border-t-transparent rounded-full animate-spin" />
          Processing...
        </>
      ) : (
        '🔥 Auto-Consec'
      )}
    </button>
  );
};

function AdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const dateFromQuery = searchParams.get('date');
  
  const [hoveredBookingId, setHoveredBookingId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(dateFromQuery || dayjs().format('YYYY-MM-DD'));
  const [isQuickResOpen, setIsQuickResOpen] = useState(false);

  // Update URL when date changes to keep it in sync
  useEffect(() => {
    if (selectedDate) {
      setSearchParams({ date: selectedDate }, { replace: true });
    }
  }, [selectedDate, setSearchParams]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 h-screen overflow-hidden">
      <div className="max-w-400 mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-2rem)]">
        {/* Left Column: Floor Plan + Analytics */}
        <div className="lg:col-span-9 flex flex-col gap-4 h-full overflow-hidden">
            <header className="flex justify-between items-end flex-none">
                <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">MBC <span className="text-slate-400">Manager</span></h1>
                   <p className="text-slate-500 font-medium">{dayjs(selectedDate).format('dddd, D MMM YYYY')}</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setIsQuickResOpen(true)}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg active:scale-95 flex items-center gap-2 cursor-pointer"
                    >
                        <span className="text-lg">+</span> Quick Res
                    </button>
                    <Link 
                        to={`/assign?date=${selectedDate}`} 
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                    >
                        Assign Tables
                    </Link>
                </div>
            </header>
            
            <div className="flex-none">
                 <Analytics date={selectedDate} />
            </div>

            <div className="flex-1 min-h-0 overflow-hidden relative rounded-3xl bg-white shadow-sm border border-slate-200">
                <FloorPlan hoveredBookingId={hoveredBookingId} selectedDate={selectedDate} />
            </div>
        </div>

        {/* Right Column: Agenda */}
        <div className="lg:col-span-3 flex flex-col gap-4 h-full min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto pr-2">
                 <Agenda 
                    setHoveredBookingId={setHoveredBookingId} 
                    date={selectedDate}
                    setDate={setSelectedDate}
                 />
            </div>
            
            {/* Auto-Consec Button for Testing */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex-none">
                <AutoConsecButton date={selectedDate} />
            </div>
        </div>
      </div>

      <AdminQuickReservation 
        isOpen={isQuickResOpen} 
        onClose={() => setIsQuickResOpen(false)} 
        selectedDate={selectedDate}
        onSuccess={() => {
            // Force refresh of floor plan and agenda if needed
            window.location.reload(); // Simple way for now, or use a context/refetch
        }}
      />
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/book" element={<BookingPage />} />
          <Route element={<ProtectedRoutes />}>
            <Route element={<BookingsProvider><Outlet /></BookingsProvider>}>
                <Route path="/assign" element={<TableAssignmentPage />} />
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  )
}

export default App;
