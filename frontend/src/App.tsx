import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { FloorPlan } from './components/FloorPlan';
import { Agenda } from './components/Agenda';
import { Analytics } from './components/Analytics';
import { BookingPage } from './components/BookingPage';
import { TableAssignmentPage } from './components/TableAssignmentPage';
import { LanguageProvider } from './i18n/LanguageContext';

import { AdminQuickReservation } from './components/AdminQuickReservation';
import { LoginPage } from './components/LoginPage';

function AdminDashboard() {
  const [hoveredBookingId, setHoveredBookingId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [isQuickResOpen, setIsQuickResOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-400 mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-4rem)]">
        {/* Left Column: Floor Plan + Analytics */}
        <div className="lg:col-span-8 flex flex-col gap-8 h-full">
            <header className="flex justify-between items-end">
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
                        to="/assign" 
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                    >
                        Assign Tables
                    </Link>
                </div>
            </header>
            
            <div className="flex-none">
                 <Analytics date={selectedDate} />
            </div>

            <div className="flex-1 min-h-0">
                <FloorPlan hoveredBookingId={hoveredBookingId} selectedDate={selectedDate} />
            </div>
        </div>

        {/* Right Column: Agenda */}
        <div className="lg:col-span-4 flex flex-col gap-8 h-full">
            <div className="flex-1 min-h-0">
                 <Agenda 
                    setHoveredBookingId={setHoveredBookingId} 
                    date={selectedDate}
                    setDate={setSelectedDate}
                 />
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
          <Route path="/assign" element={<TableAssignmentPage />} />
          <Route path="/admin" element={<AdminDashboard />} />

        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  )
}

export default App;
