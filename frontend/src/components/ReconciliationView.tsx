import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, ShieldCheck, CircleAlert, HandCoins, Undo2 } from 'lucide-react';
import { api } from '../services/api';
import type { ReconciliationHold } from '../types/index';

const eur = (cents: number | null) =>
    cents == null ? '—' : `${(cents / 100).toFixed(2)} €`;

/** Module-stable default so the mount effect never re-fires per render. */
const defaultFlash = (kind: 'ok' | 'err', text: string) =>
    (kind === 'err' ? console.error(text) : console.info(text));

const fmtTime = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });

/**
 * End-of-shift reconciliation (fail-safe holds).
 * Lists every reservation from the last 24h still HELD so the manager can,
 * BEFORE Stripe's ~7-day window expires them automatically:
 * - "Arrived" → releases the hold (HELD → RELEASED, guest never charged);
 * - "No-show & charge" → captures the fee (HELD → CAPTURED).
 * Charging requires an explicit two-tap confirm — there is no auto-capture
 * anywhere in the system, and this button is its only trigger.
 */
export const ReconciliationView: React.FC<{
    flash?: (kind: 'ok' | 'err', text: string) => void;
    onResolved?: () => void;
}> = ({ flash = defaultFlash, onResolved }) => {
    const [holds, setHolds] = useState<ReconciliationHold[] | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [confirmCharge, setConfirmCharge] = useState<string | null>(null);

    // Refs carry the latest callbacks without re-triggering the mount effect.
    const flashRef = useRef(flash);
    flashRef.current = flash;
    const resolvedRef = useRef(onResolved);
    resolvedRef.current = onResolved;

    const load = useCallback(async () => {
        try {
            setHolds(await api.getReconciliationHolds());
        } catch {
            setHolds([]);
            flashRef.current('err', 'Could not load unresolved holds.');
        }
        // Mount + manual refresh only; refs stay out of the dep list.
    }, []);

    useEffect(() => {
        // Fetch-on-mount: intentional data load, not derived state.
        void load();
    }, [load]);

    const resolve = async (id: string, action: 'release' | 'charge') => {
        setBusy(id);
        try {
            if (action === 'release') await api.checkIn(id);
            else await api.markNoShowAndCharge(id);
            flashRef.current('ok', action === 'release' ? 'Hold released — guest not charged.' : 'No-show fee captured.');
            setConfirmCharge(null);
            await load();
            resolvedRef.current?.();
        } catch {
            flashRef.current('err', action === 'release' ? 'Release failed — try again.' : 'Capture failed — hold left untouched.');
        } finally {
            setBusy(null);
        }
    };

    if (holds === null) {
        return (
            <div className="rounded-3xl bg-white p-8 flex items-center justify-center gap-2 text-slate-500">
                <Loader2 className="animate-spin" size={18} /> Loading unresolved holds…
            </div>
        );
    }

    if (holds.length === 0) {
        return (
            <div className="rounded-3xl bg-emerald-50 border border-emerald-200 p-8 text-center">
                <ShieldCheck className="mx-auto text-emerald-600" size={28} />
                <p className="mt-2 font-black text-slate-900">Shift reconciled</p>
                <p className="text-sm text-slate-600">No unresolved holds from the last 24h. Nothing will expire or charge.</p>
            </div>
        );
    }

    return (
        <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <CircleAlert className="text-amber-500" size={18} />
                <h2 className="font-black text-slate-900">
                    {holds.length} unresolved hold{holds.length > 1 ? 's' : ''}
                </h2>
                <span className="text-xs text-slate-500">last 24h — release or charge before Stripe expiry</span>
            </div>
            <ul className="divide-y divide-slate-100">
                {holds.map((h) => (
                    <li key={h.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                            <p className="font-black text-slate-900 truncate">{h.name} · {h.size} guests</p>
                            <p className="text-xs text-slate-500">
                                {fmtTime(h.startTime)} · {eur(h.depositAmountCents)} hold · unresolved {h.hoursUnresolved}h
                            </p>
                        </div>
                        {confirmCharge === h.id ? (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-600">Charge {eur(h.depositAmountCents)}?</span>
                                <button
                                    disabled={busy === h.id}
                                    onClick={() => resolve(h.id, 'charge')}
                                    className="rounded-2xl bg-slate-900 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                                >
                                    Confirm charge
                                </button>
                                <button
                                    disabled={busy === h.id}
                                    onClick={() => setConfirmCharge(null)}
                                    className="rounded-2xl bg-slate-100 px-4 py-2 text-xs font-black text-slate-700"
                                >
                                    Back
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <button
                                    disabled={busy === h.id}
                                    onClick={() => resolve(h.id, 'release')}
                                    className="rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50 flex items-center gap-1"
                                >
                                    <Undo2 size={14} /> Arrived
                                </button>
                                <button
                                    disabled={busy === h.id}
                                    onClick={() => setConfirmCharge(h.id)}
                                    className="rounded-2xl bg-indigo-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50 flex items-center gap-1"
                                >
                                    <HandCoins size={14} /> No-show & charge
                                </button>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
};
