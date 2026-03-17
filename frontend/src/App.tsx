import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrowserRouter, Routes, Route, Link, useSearchParams } from 'react-router-dom';
import { Map as MapIcon, X, AlertTriangle } from 'lucide-react';
import dayjs, { RESTAURANT_TZ } from './utils/dayjs';
import { FloorPlan } from './components/FloorPlan';
import { Agenda } from './components/Agenda';
import { Analytics } from './components/Analytics';
import { BookingPage } from './components/BookingPage';
import { TableAssignmentPage } from './components/TableAssignmentPage';
import { LanguageProvider } from './i18n/LanguageContext';
import { DatePicker } from './components/ui/date-picker';
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
  const [selectedDate, setSelectedDate] = useState(dateFromQuery || dayjs.tz(undefined, RESTAURANT_TZ).format('YYYY-MM-DD'));
  const [testDate, setTestDate] = useState(selectedDate);
  const [isQuickResOpen, setIsQuickResOpen] = useState(false);
  const [showMobileFloorPlan, setShowMobileFloorPlan] = useState(false);
  const { bookings } = useBookingsContext();

  const dailyBookings = bookings.filter(b => 
    dayjs(b.startTime).tz(RESTAURANT_TZ).format('YYYY-MM-DD') === selectedDate && 
    b.status !== 'CANCELLED'
  );
  
  const occupiedTables = new Set<string>();
  dailyBookings.forEach(b => {
    b.tables?.forEach(t => occupiedTables.add(t.name));
  });
  
  const occupancyRate = (occupiedTables.size / 36) * 100;

  // Sync testDate with selectedDate by default when selectedDate changes
  useEffect(() => {
    setTestDate(selectedDate);
  }, [selectedDate]);

  // Update URL when date changes to keep it in sync
  useEffect(() => {
    if (selectedDate) {
      setSearchParams({ date: selectedDate }, { replace: true });
    }
  }, [selectedDate, setSearchParams]);

  return (
    <div className="min-h-screen bg-slate-50 p-3 lg:p-4 h-screen overflow-hidden flex flex-col">
      <div className="max-w-[1600px] mx-auto w-full flex flex-col h-full gap-4">
        {/* Header Column */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-none">
          <div className="flex items-center justify-between w-full sm:w-auto gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight leading-none">MBC <span className="text-slate-400">Manager</span></h1>
              <p className="text-slate-500 font-bold text-xs lg:text-sm mt-1">{dayjs.tz(selectedDate, RESTAURANT_TZ).format('dddd, D MMM YYYY')}</p>
            </div>
            {occupancyRate >= 70 && (
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-2xl animate-pulse shadow-sm">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest leading-none">High Capacity</span>
                  <span className="text-xs font-bold">{Math.round(occupancyRate)}% of tables booked</span>
                </div>
              </div>
            )}
            {/* Mobile Map Toggle */}
            <div className="flex items-center gap-2 lg:hidden">
              {occupancyRate >= 70 && (
                <div className="sm:hidden flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl animate-pulse shadow-sm">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-wider">{Math.round(occupancyRate)}% full</span>
                </div>
              )}
              <button 
                onClick={() => setShowMobileFloorPlan(true)}
                className="lg:hidden p-3 bg-white border-2 border-slate-100 rounded-2xl shadow-sm text-indigo-600 active:scale-95 transition-all"
              >
                <MapIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button 
              onClick={() => setIsQuickResOpen(true)}
              className="flex-1 sm:flex-none bg-slate-900 hover:bg-slate-800 text-white px-4 lg:px-6 py-3 rounded-2xl font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              <span className="text-lg font-black">+</span> <span>Quick Res</span>
            </button>
            <Link 
              to={`/assign?date=${selectedDate}`} 
              className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-500 text-white px-4 lg:px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95 flex items-center justify-center text-sm"
            >
              Assign Tables
            </Link>
          </div>
        </header>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Main Content: Maps & Analytics (Hidden on mobile by default) */}
          <div className="hidden lg:flex lg:col-span-9 flex-col gap-4 min-h-0">
            <div className="flex-none">
              <Analytics date={selectedDate} />
            </div>

            <div className="flex-1 min-h-0 overflow-hidden relative rounded-[2.5rem] bg-white shadow-xl shadow-slate-200/50 border border-slate-200/60 group/floorplan">
              <div className="absolute top-8 left-10 z-10 transition-transform duration-500 group-hover/floorplan:scale-105">
                <div className="flex items-center gap-2.5 px-4 py-2 bg-white/90 backdrop-blur-xl rounded-full border border-slate-100 shadow-lg shadow-slate-200/20">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Live Floor Plan</span>
                </div>
              </div>
              <FloorPlan hoveredBookingId={hoveredBookingId} selectedDate={selectedDate} />
            </div>
          </div>

          {/* Right Column: Agenda (Full width on mobile) */}
          <div className="col-span-1 lg:col-span-3 flex flex-col gap-4 min-h-0">
            <div className="flex-1 min-h-0 overflow-hidden">
                 <Agenda 
                    setHoveredBookingId={setHoveredBookingId} 
                    date={selectedDate}
                    setDate={setSelectedDate}
                 />
            </div>
            
            {/* Auto-Consec Button */}
            <div className="hidden lg:block p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex-none space-y-3">
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Test Date</label>
                    <DatePicker 
                        date={dayjs(testDate).toDate()} 
                        setDate={(d) => setTestDate(dayjs(d).format('YYYY-MM-DD'))}
                        className="h-10 text-xs font-bold"
                    />
                </div>
                <AutoConsecButton date={testDate} />
            </div>
          </div>
        </div>
      </div>

      {/* Full-Screen Mobile Floor Plan Overlay */}
      <AnimatePresence>
        {showMobileFloorPlan && (
          <motion.div 
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[100] bg-white flex flex-col"
          >
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                  <MapIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Interactive Map</h3>
                  <p className="text-[10px] text-slate-400 font-bold">Zoom/Pan to explore</p>
                </div>
              </div>
              <button 
                onClick={() => setShowMobileFloorPlan(false)}
                className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-900 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 relative bg-slate-50 overflow-hidden">
               <div className="w-full h-full p-2">
                  <div className="w-full h-full rounded-3xl overflow-hidden border-2 border-indigo-100 shadow-2xl bg-white relative">
                    <FloorPlan 
                      hoveredBookingId={hoveredBookingId} 
                      selectedDate={selectedDate} 
                      hideControls={true}
                    />
                  </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AdminQuickReservation 
        isOpen={isQuickResOpen} 
        onClose={() => setIsQuickResOpen(false)} 
        selectedDate={selectedDate}
        onSuccess={(bookedDate) => {
          if (bookedDate && bookedDate !== selectedDate) {
            setSelectedDate(bookedDate);
          }
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
