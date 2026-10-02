import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Landmark, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { useTranslation } from '../i18n/useTranslation';

interface Status {
    configured: boolean;
    mode: 'test' | 'live' | 'unconfigured';
    accountId: string | null;
    onboarded: boolean;
}

/**
 * Per-restaurant Stripe Connect Express: one account per restaurant so
 * holds and no-show captures land directly on their balance. Without a
 * finished onboarding, holds fall back to the platform account (test mode).
 */
type LoadError = { status?: number; message: string };

function toLoadError(e: unknown, fallback: string): LoadError {
    const err = e as Error & { status?: number };
    return { status: typeof err.status === 'number' ? err.status : undefined, message: err instanceof Error ? err.message : fallback };
}

export const StripeConnectBlock: React.FC<{
    refresh: () => Promise<void>;
    flash: (kind: 'ok' | 'err', text: string) => void;
}> = ({ refresh, flash }) => {
    const { t } = useTranslation();
    const [status, setStatus] = useState<Status | null>(null);
    const [loadError, setLoadError] = useState<LoadError | null>(null);
    const [connectError, setConnectError] = useState<LoadError | null>(null);
    const [busy, setBusy] = useState(false);
    // Back from Stripe onboarding (?stripe=done) — consume once, refresh after.
    const [returned] = useState(() => {
        try {
            const q = new URLSearchParams(window.location.search).get('stripe');
            if (q) window.history.replaceState({}, '', window.location.pathname);
            return !!q;
        } catch {
            return false;
        }
    });

    const load = useCallback(async () => {
        setLoadError(null);
        try {
            setStatus(await api.stripeStatus());
        } catch (e) {
            setStatus(null);
            setLoadError(toLoadError(e, t('settings.saveFailed')));
        }
    }, [t]);

    useEffect(() => {
        void (returned ? refresh().then(() => load()).catch(() => load()) : load());
    }, [load, refresh, returned]);

    const connect = async () => {
        setBusy(true);
        setConnectError(null);
        try {
            const { url } = await api.stripeConnect();
            if (!url || typeof url !== 'string') throw new Error(t('settings.saveFailed'));
            window.location.assign(url);
        } catch (e) {
            const mapped = toLoadError(e, t('settings.saveFailed'));
            setConnectError(mapped);
            flash('err', mapped.message);
            setBusy(false);
        }
    };

    const actionableHint = (err: LoadError | null): string | null => {
        if (!err) return null;
        if (err.status === 401) return t('settings.stripeErrSession');
        if (err.status === 403) return t('settings.stripeErrRole');
        if (/not activated|onboarding/i.test(err.message)) return t('settings.stripeErrActivation');
        if (/trial|subscription|read-only/i.test(err.message)) return t('settings.stripeErrTrial');
        if (/not configured|STRIPE_SECRET_KEY/i.test(err.message)) return t('settings.stripeErrUnconfigured');
        return null;
    };

    const failure = connectError ?? loadError;
    const hint = actionableHint(failure);

    // Unconfigured backend: explain instead of hiding, so owners know what to do.
    if (status && !status.configured && !failure) {
        return (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 flex items-center gap-3">
                <Landmark className="w-5 h-5 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-900">{t('settings.stripeTitle')}</p>
                    <p className="text-[11px] text-slate-500 font-medium">{t('settings.stripeErrUnconfigured')}</p>
                </div>
            </div>
        );
    }

    const showRetry = !!failure;

    return (
        <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-3 flex flex-col gap-2">
            <div className="flex items-center gap-3">
                {status?.onboarded ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : failure ? (
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                ) : (
                    <Landmark className="w-5 h-5 text-violet-600 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-900 flex items-center gap-1.5 flex-wrap">
                        {status?.onboarded ? t('settings.stripeOn') : t('settings.stripeTitle')}
                        {status && status.mode !== 'live' && (
                            <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 border border-amber-200">
                                {t('settings.stripeTestMode')}
                            </span>
                        )}
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium">
                        {status?.onboarded
                            ? t('settings.stripeOnMsg')
                            : status
                                ? t('settings.stripeMsg')
                                : failure
                                    ? failure.message
                                    : t('settings.stripeLoading')}
                    </p>
                </div>
                {!status?.onboarded && (
                    <button
                        onClick={connect}
                        disabled={busy || (!status && !failure)}
                        className="min-h-[44px] shrink-0 bg-violet-600 hover:bg-violet-500 text-white px-4 rounded-xl text-xs font-black transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
                    >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertCircle className="w-4 h-4" />}
                        {t('settings.stripeConnect')}
                    </button>
                )}
            </div>
            {hint && (
                <p className="text-[11px] font-bold text-slate-700 bg-white/70 border border-violet-100 rounded-xl px-3 py-2">
                    {hint}
                </p>
            )}
            {showRetry && (
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => { setConnectError(null); void load(); }}
                        className="min-h-[40px] px-3 rounded-xl text-[11px] font-black bg-white border border-violet-200 text-violet-700 hover:bg-violet-50 transition-all cursor-pointer"
                    >
                        {t('settings.stripeRetry')}
                    </button>
                    <span className="text-[10px] text-slate-400 font-medium">{t('settings.stripePrivateHint')}</span>
                </div>
            )}
            {!status?.onboarded && !failure && (
                <ol className="text-[10px] text-slate-500 font-medium list-decimal list-inside space-y-0.5">
                    <li>{t('settings.stripeStep1')}</li>
                    <li>{t('settings.stripeStep2')}</li>
                    <li>{t('settings.stripeStep3')}</li>
                </ol>
            )}
        </div>
    );
};
