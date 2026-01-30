import React, { useState } from 'react';
import CanadianLeafLoader from './CanadianLeafLoader';
import { Eye, EyeOff } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
      } else {
        setShowLoader(true);
        localStorage.setItem('token', data.accessToken);
        setTimeout(() => {
          window.location.href = '/admin/dashboard';
        }, 1800);
      }
    } catch (err) {
      setError('Network error');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden">
      {/* Soft background shapes */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-red-50 rounded-full blur-3xl opacity-30 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-slate-200 rounded-full blur-2xl opacity-20 pointer-events-none" />
      {showLoader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-90">
          <CanadianLeafLoader />
        </div>
      )}
      {!showLoader && (
        <form
          onSubmit={handleSubmit}
          className="relative bg-white/90 backdrop-blur-md p-10 rounded-2xl shadow-xl w-full max-w-md flex flex-col gap-7 border border-slate-100 animate-fade-in"
          aria-label="Login form"
        >
          <div className="flex flex-col items-center mb-2">
            <img
              src="/public/mbc-logo.png"
              alt="MBC Logo"
              className="w-20 h-20 mb-2 drop-shadow-sm"
              style={{ objectFit: 'contain' }}
            />
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-1">
              MBC Booking System
            </h1>
            <span className="text-slate-500 text-sm">Sign in to your account</span>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-slate-700 font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 transition placeholder-slate-400 text-base bg-slate-50"
              placeholder="you@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={loading}
              spellCheck={false}
            />
          </div>
          <div className="flex flex-col gap-2 relative">
            <label htmlFor="password" className="text-slate-700 font-medium">
              Password
            </label>
            <div className="relative flex items-center">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="border border-slate-200 rounded-lg px-3 pr-12 py-3 h-12 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 transition placeholder-slate-400 text-base bg-slate-50 w-full"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                tabIndex={-1}
                className="absolute right-3 flex items-center justify-center h-6 w-6 text-slate-400 hover:text-slate-600 transition"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={loading}
                style={{ padding: 0, background: 'none', border: 'none' }}
              >
                {showPassword ? (
                  <EyeOff className="w-6 h-6" />
                ) : (
                  <Eye className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
          {error && (
            <div className="text-red-600 text-sm text-center border border-red-100 bg-red-50 rounded p-2 animate-shake">
              {error}
            </div>
          )}
          <button
            type="submit"
            className="bg-slate-800 text-white rounded-lg py-2 font-semibold shadow-sm hover:bg-slate-700 transition-all duration-150 cursor-pointer mt-2 disabled:opacity-60 flex items-center justify-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <>
                Logging in...
              </>
            ) : (
              'Login'
            )}
          </button>
          <style>{`
            .animate-fade-in {
              animation: fadeIn 0.7s cubic-bezier(.4,0,.2,1);
            }
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(24px) scale(0.98);}
              to { opacity: 1; transform: none;}
            }
            .animate-shake {
              animation: shake 0.3s cubic-bezier(.36,.07,.19,.97) both;
            }
            @keyframes shake {
              10%, 90% { transform: translateX(-1px);}
              20%, 80% { transform: translateX(2px);}
              30%, 50%, 70% { transform: translateX(-4px);}
              40%, 60% { transform: translateX(4px);}
            }
          `}</style>
        </form>
      )}
    </div>
  );
}