import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useSearchParams, Navigate } from 'react-router-dom';
import { Map as MapIcon, List, Settings as SettingsIcon, ChartColumn } from 'lucide-react';
import dayjs, { RESTAURANT_TZ } from './utils/dayjs';
import { FloorPlan } from './components/FloorPlan';
import { Agenda } from './components/Agenda';
import { AnalyticsPage } from './components/AnalyticsPage';
import { BookingPage } from './components/BookingPage';
import { SettingsPage } from './components/SettingsPage';
import { FloorPlanEditor } from './components/FloorPlanEditor';
import LandingPage from './pages/LandingPage';
import { LanguageProvider } from './i18n/LanguageContext';
import { useTranslation } from './i18n/useTranslation';
import { AdminQuickReservation } from './components/AdminQuickReservation';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { VerifyEmailPage } from './components/VerifyEmailPage';
import { OnboardingPage } from './components/OnboardingPage';
import { NotFound } from './components/NotFound';
import { ProtectedRoutes } from './components/ProtectedRoutes';
import { BookingsProvider } from './context/BookingsContext';
import { useBookingsContext } from './context/useBookingsContext';
import { matchesHostQuery } from './utils/bookingUtils';
import { HostSearchBar } from './components/HostSearchBar';
import { api } from './services/api';
import { AutoConsecButton } from './components/AutoConsecButton';
import { TrialBanner } from './components/TrialBanner';
import { isDemoSession } from './utils/auth';
import { Outlet } from 'react-router-dom';

function AdminDashboard() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const dateFromQuery = searchParams.get('date');
  
  const [hoveredBookingId, setHoveredBookingId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(dateFromQuery || dayjs.tz(undefined, RESTAURANT_TZ).format('YYYY-MM-DD'));
  const [isQuickResOpen, setIsQuickResOpen] = useState(false);
  const [quickTable, setQuickTable] = useState<string | null>(null);
  // Small screens: both views stay mounted, only one is shown — switching
  // never loses search, selection or an ongoing placement.
  const [mobileView, setMobileView] = useState<'map' | 'list'>('list');
  // Host console state: one query drives the arrivals list + map glow,
  // and one selected booking drives inline placement on the map.
  const [hostQuery, setHostQuery] = useState('');
  const [placementBookingId, setPlacementBookingId] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const { bookings, refresh } = useBookingsContext();

  const dayBookings = bookings.filter(
    b => dayjs(b.startTime).tz(RESTAURANT_TZ).format('YYYY-MM-DD') === selectedDate && b.status !== 'CANCELLED',
  );
  const nowStamp = dayjs();
  const arrivalsNow = dayBookings.filter(b => {
    if (b.status !== 'PENDING' && b.status !== 'CONFIRMED') return false;
    const unseated = !b.tables || b.tables.length === 0;
    const arriving = dayjs(b.startTime).diff(nowStamp, 'minute') <= 45;
    return unseated || arriving;
  }).length;
  const queryMatches = hostQuery.trim() === '' ? [] : dayBookings.filter(b => matchesHostQuery(b, hostQuery));
  const placementBooking = placementBookingId ? (bookings.find(b => b.id === placementBookingId) ?? null) : null;

  const handleSearchSubmit = () => {
    if (queryMatches.length === 1) {
      const only = queryMatches[0];
      if (!only.tables || only.tables.length === 0) setPlacementBookingId(only.id);
      setHoveredBookingId(only.id);
    }
  };

  const handlePlacementSave = async (bookingId: string, tableNames: string[], andCheckIn: boolean) => {
    await api.updateAssignment(bookingId, tableNames);
    if (andCheckIn) {
      try {
        await api.checkIn(bookingId);
      } catch (e) {
        console.error('Check-in after placement failed', e);
      }
    }
    await refresh();
    setPlacementBookingId(null);
  };

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
              <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight leading-none">Faci<span className="text-indigo-500">-</span>Table</h1>
              <p className="text-slate-500 font-bold text-xs lg:text-sm mt-1">{dayjs.tz(selectedDate, RESTAURANT_TZ).format('dddd, D MMM YYYY')}</p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button 
              onClick={() => setIsQuickResOpen(true)}
              className="flex-1 sm:flex-none bg-slate-900 hover:bg-slate-800 text-white px-4 lg:px-6 py-3 rounded-2xl font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              <span className="text-lg font-black">+</span> <span>{t('dashboard.quickRes')}</span>
            </button>
            <Link 
              to={`/app/analytics?date=${selectedDate}`} 
              className="sm:flex-none p-3 bg-white border-2 border-slate-100 rounded-2xl shadow-sm text-slate-500 hover:text-slate-900 active:scale-95 transition-all flex items-center justify-center"
              title={t('dashboard.analyticsTitle')}
            >
              <ChartColumn className="w-5 h-5" />
            </Link>
            <Link
              to="/app/settings"
              className="sm:flex-none p-3 bg-white border-2 border-slate-100 rounded-2xl shadow-sm text-slate-500 hover:text-slate-900 active:scale-95 transition-all flex items-center justify-center"
              title={t('dashboard.settingsTitle')}
            >
              <SettingsIcon className="w-5 h-5" />
            </Link>
          </div>
        </header>

        <TrialBanner />

        <div className="flex-none">
          <HostSearchBar
            value={hostQuery}
            onChange={setHostQuery}
            matchCount={queryMatches.length}
            onSubmit={handleSearchSubmit}
          />
        </div>

        {/* Small screens: Carte / Arrivées tabs (both views stay mounted). */}
        <div className="flex-none md:hidden flex bg-white border-2 border-slate-100 rounded-2xl p-1 gap-1 shadow-sm">
          <button
            onClick={() => setMobileView('map')}
            className={`flex-1 h-11 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 ${mobileView === 'map' ? 'bg-slate-900 text-white shadow' : 'text-slate-400'}`}
          >
            <MapIcon className="w-4 h-4" /> {t('dashboard.tabMap')}
          </button>
          <button
            onClick={() => setMobileView('list')}
            className={`flex-1 h-11 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 ${mobileView === 'list' ? 'bg-slate-900 text-white shadow' : 'text-slate-400'}`}
          >
            <List className="w-4 h-4" /> {t('dashboard.tabList')}
            {arrivalsNow > 0 && (
              <span className={`min-w-5 h-5 px-1 rounded-full text-[10px] font-black flex items-center justify-center tabular-nums ${mobileView === 'list' ? 'bg-indigo-500 text-white' : 'bg-red-500 text-white'}`}>
                {arrivalsNow}
              </span>
            )}
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Main Content: live map (analytics moved to /app/analytics) */}
          <div className={`${mobileView === 'map' ? 'flex' : 'hidden'} md:flex md:col-span-7 xl:col-span-9 flex-col gap-4 min-h-0`}>
            <div className="flex-1 min-h-[480px] overflow-hidden relative rounded-[2.5rem] bg-white shadow-xl shadow-slate-200/50 border border-slate-200/60">
              <FloorPlan
                hoveredBookingId={hoveredBookingId}
                selectedDate={selectedDate}
                initialViewMode="LIVE"
                highlightBookingIds={queryMatches.map(b => b.id)}
                placementBooking={placementBooking}
                onPlacementSave={handlePlacementSave}
                onPlacementCancel={() => setPlacementBookingId(null)}
                selectedTableId={selectedTableId}
                onSelectTable={setSelectedTableId}
                onFocusBooking={name => {
                  setHostQuery(name);
                  setMobileView('list');
                }}
                onQuickCreate={tableId => {
                  setQuickTable(tableId);
                  setIsQuickResOpen(true);
                }}
              />
            </div>
          </div>

          {/* Right Column: Agenda (Full width on mobile) */}
          <div className={`${mobileView === 'list' ? 'flex' : 'hidden'} md:flex col-span-1 md:col-span-5 xl:col-span-3 flex-col gap-4 min-h-0`}>
            <div className="flex-1 min-h-0 overflow-hidden">
                 <Agenda 
                    setHoveredBookingId={setHoveredBookingId} 
                    date={selectedDate}
                    setDate={setSelectedDate}
                    externalQuery={hostQuery}
                    selectedBookingId={placementBookingId}
                    onPlaceTables={setPlacementBookingId}
                 />
            </div>
            {isDemoSession() && (
              <div className="hidden md:block p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex-none">
                <AutoConsecButton date={selectedDate} />
              </div>
            )}
          </div>
        </div>
      </div>

      <AdminQuickReservation 
        isOpen={isQuickResOpen} 
        onClose={() => {
          setIsQuickResOpen(false);
          setQuickTable(null);
        }} 
        selectedDate={selectedDate}
        initialTable={quickTable}
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
          {/* Public marketing + guest flows */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/book" element={<BookingPage />} />
          {/* Clean public booking URL: mbc-reservation.vercel.app/le-petit-cafe */}
          <Route path="/:slug" element={<BookingPage />} />
          {/* Authenticated product */}
          <Route element={<ProtectedRoutes />}>
            <Route element={<BookingsProvider><Outlet /></BookingsProvider>}>
                <Route path="/onboarding" element={<OnboardingPage />} />
                <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />
                <Route path="/app/dashboard" element={<AdminDashboard />} />
                <Route path="/app/analytics" element={<AnalyticsPage />} />
                <Route path="/app/settings" element={<SettingsPage />} />
                <Route path="/app/floor-plan" element={<FloorPlanEditor />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  )
}

export default App;
