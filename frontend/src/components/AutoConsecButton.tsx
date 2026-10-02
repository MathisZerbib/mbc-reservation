import { useState } from 'react';
import { useBookingsActions } from '../hooks/useBookings';
import { useTranslation } from '../i18n/useTranslation';

export function AutoConsecButton({ date }: { date: string }) {
  const { t } = useTranslation();
  const { autoConsec } = useBookingsActions();
  const [loading, setLoading] = useState(false);

  const handleAutoConsec = async () => {
    if (!window.confirm(t('autoconsec.confirmMsg').replace('{date}', date))) return;
    setLoading(true);
    try {
      await autoConsec(date);
      alert(t('autoconsec.success'));
    } catch (error) {
      console.error('Auto-consec failure:', error);
      alert(t('autoconsec.failedPre') + (error as Error).message);
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
          {t('autoconsec.processing')}
        </>
      ) : (
        t('autoconsec.label')
      )}
    </button>
  );
}
