import { useState } from 'react';
import { api } from '../services/api';
import { useBookingsContext } from '../context/useBookingsContext';

export function AutoConsecButton({ date }: { date: string }) {
  const { refresh } = useBookingsContext();
  const [loading, setLoading] = useState(false);

  const handleAutoConsec = async () => {
    if (!window.confirm(`Trigger auto-consecutive bookings for ${date}?`)) return;
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
}
