import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../services/api';
import { useTranslation } from '../i18n/useTranslation';
import { LangToggle } from './LangToggle';

/** Handles /verify-email?token=… links: activates the account, then signs in. */
export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [status, setStatus] = useState<'loading' | 'ok' | 'err'>('loading');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setStatus('err');
      return;
    }
    api.verifyEmail(token)
      .then(data => {
        localStorage.setItem('token', data.accessToken);
        setStatus('ok');
        setTimeout(() => navigate('/admin/dashboard'), 1500);
      })
      .catch(() => setStatus('err'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative">
      <div className="absolute top-4 right-4">
        <LangToggle />
      </div>
      <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-md flex flex-col items-center gap-4 border border-slate-100 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            <p className="text-slate-600 font-medium">{t('verify.verifying')}</p>
          </>
        )}
        {status === 'ok' && (
          <>
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            <h1 className="text-xl font-extrabold text-slate-800">{t('verify.okTitle')}</h1>
            <p className="text-slate-500 text-sm">{t('verify.okMsg')}</p>
          </>
        )}
        {status === 'err' && (
          <>
            <XCircle className="w-10 h-10 text-red-500" />
            <h1 className="text-xl font-extrabold text-slate-800">{t('verify.errTitle')}</h1>
            <p className="text-slate-500 text-sm">{t('verify.errMsg')}</p>
            <Link to="/login" className="font-bold text-slate-800 hover:underline text-sm">
              {t('verify.goSignin')}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
