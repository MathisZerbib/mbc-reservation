import { Link } from 'react-router-dom';
import { useTranslation } from '../i18n/useTranslation';

/** Minimal 404 — unknown paths return here instead of a blank screen. */
export function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-md flex flex-col items-center gap-3 border border-slate-100 text-center">
        <span className="text-5xl font-black text-slate-200">404</span>
        <h1 className="text-xl font-extrabold text-slate-800">{t('notfound.title')}</h1>
        <p className="text-slate-500 text-sm">{t('notfound.msg')}</p>
        <Link to="/" className="mt-2 font-bold text-slate-800 hover:underline text-sm">
          {t('notfound.home')}
        </Link>
      </div>
    </div>
  );
}
