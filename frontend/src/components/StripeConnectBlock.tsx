import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Landmark, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { useTranslation } from '../i18n/useTranslation';

interface Status {
    configured: boolean;
    accountId: string | null;
    onboarded: boolean;
}

/**
 * Per-restaurant Stripe Connect Express: one account per restaurant so
 * holds and no-show captures land directly on their balance. Without a
 * finished onboarding, holds fall back to the platform account (test mode).
 */
export const StripeConnectBlock: React.FC<{
    refresh: () => Promise<void>;
    flash: (kind: 'ok' | 'err', text: string) => void;
}> = ({ refresh, flash }) => {
    const { t } = useTranslation();
    const [status, setStatus] = useState<Status | null>(null);
    const [busy, setBusy] = useState(false);
    // Back from Stripe onboarding (?stripe=done) — consume once, refresh after.
    const [returned] = useState(() => {
        const q = new URLSearchParams(window.location.search).get('stripe');
        if (q) window.history.replaceState({}, '', window.location.pathname);
        return !!q;
    });

    const load = useCallback(async () => {
        try {
            setStatus(await api.stripeStatus());
        } catch {
            setStatus(null);
        }
    }, []);

    useEffect(() => {
        // Fetch-on-mount: intentional data load, not derived state.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (returned) void refresh().then(() => load());
        else void load();
    }, [load, refresh, returned]);

    const connect = async () => {
        setBusy(true);
        try {
            const { url } = await api.stripeConnect();
            window.location.href = url;
        } catch (e) {
            flash('err', e instanceof Error ? e.message : t('settings.saveFailed'));
            setBusy(false);
        }
    };

    if (status && !status.configured) return null;

    return (
        <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-3 flex items-center gap-3">
            {status?.onboarded ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
                <Landmark className="w-5 h-5 text-violet-600 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-slate-900">
                    {status?.onboarded ? t('settings.stripeOn') : t('settings.stripeTitle')}
                </p>
                <p className="text-[11px] text-slate-500 font-medium">
                    {status?.onboarded
                        ? t('settings.stripeOnMsg')
                        : status
                            ? t('settings.stripeMsg')
                            : t('settings.stripeLoading')}
                </p>
            </div>
            {!status?.onboarded && (
                <button
                    onClick={connect}
                    disabled={busy || !status}
                    className="min-h-[44px] shrink-0 bg-violet-600 hover:bg-violet-500 text-white px-4 rounded-xl text-xs font-black transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertCircle className="w-4 h-4" />}
                    {t('settings.stripeConnect')}
                </button>
            )}
        </div>
    );
};
