import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BookingPage } from './components/BookingPage';
import { LivePage } from './components/LivePage';
import { PlanningPage } from './components/PlanningPage';
import { AnalyticsPage } from './components/AnalyticsPage';
import { SettingsPage } from './components/SettingsPage';
import { FloorPlanEditor } from './components/FloorPlanEditor';
import LandingPage from './pages/LandingPage';
import { LanguageProvider } from './i18n/LanguageContext';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { VerifyEmailPage } from './components/VerifyEmailPage';
import { OnboardingPage } from './components/OnboardingPage';
import { NotFound } from './components/NotFound';
import { ProtectedRoutes } from './components/ProtectedRoutes';
import { BookingsProvider } from './context/BookingsContext';
import { Outlet } from 'react-router-dom';

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
                <Route path="/app" element={<Navigate to="/app/live" replace />} />
                {/* Legacy entry point kept working */}
                <Route path="/app/dashboard" element={<Navigate to="/app/live" replace />} />
                <Route path="/app/live" element={<LivePage />} />
                <Route path="/app/planning" element={<PlanningPage />} />
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
