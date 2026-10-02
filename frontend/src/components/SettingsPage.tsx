import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Save, Euro, Image as ImageIcon, Map as MapIcon, Loader2, Timer, CreditCard, DatabaseBackup, ShieldCheck, Clock } from 'lucide-react';
import { api, fileUrl } from '../services/api';
import { useRestaurantSettings } from '../hooks/useFloorPlan';
import { useUserRole } from '../hooks/useUserRole';
import { TeamCard } from './TeamCard';
import { FloorPlanImageDropzone } from './FloorPlanImageDropzone';
import { SettingsField } from './SettingsField';
import dayjs, { RESTAURANT_TZ } from '../utils/dayjs';
import { useUiStore } from '../stores/uiStore';
import { StripeConnectBlock } from './StripeConnectBlock';
import { isDemoSession } from '../utils/auth';
import { useTranslation } from '../i18n/useTranslation';
import { cn } from '../lib/utils';
import type { OpenHours } from '../types/index';

export const SettingsPage: React.FC = () => {
    const { t, lang } = useTranslation();
    const today = dayjs.tz(undefined, RESTAURANT_TZ).format('YYYY-MM-DD');
    const setHeaderConfig = useUiStore((s) => s.setHeader);
    useEffect(() => {
        setHeaderConfig({ date: today, arrivalsNow: 0, onQuickRes: undefined });
    }, [today, setHeaderConfig]);
    const { settings, loading, refresh } = useRestaurantSettings();
    const { role, loading: roleLoading } = useUserRole();
    const [avgTicket, setAvgTicket] = useState('');
    const [avgLunch, setAvgLunch] = useState('');
    const [avgDinner, setAvgDinner] = useState('');
    const [lateGrace, setLateGrace] = useState('');
    const [turnover, setTurnover] = useState('105');
    const [autoCancel, setAutoCancel] = useState(true);
    const [depositOn, setDepositOn] = useState(false);
    const [depositMin, setDepositMin] = useState('6');
    const [depositAmount, setDepositAmount] = useState('20');
    const [openHours, setOpenHours] = useState<Exclude<OpenHours, null>>({});
    const [savingHours, setSavingHours] = useState(false);
    const [saving, setSaving] = useState(false);
    const [savingGrace, setSavingGrace] = useState(false);
    const [savingRules, setSavingRules] = useState(false);
    const [seedingDemo, setSeedingDemo] = useState(false);
    const [retention, setRetention] = useState('13');
    const [savingRetention, setSavingRetention] = useState(false);
    const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

    useEffect(() => {
        if (settings) {
            setAvgTicket(String(settings.avgTicket));
            setAvgLunch(settings.avgTicketLunch != null ? String(settings.avgTicketLunch) : '');
            setAvgDinner(settings.avgTicketDinner != null ? String(settings.avgTicketDinner) : '');
            setLateGrace(String(settings.lateGraceMinutes ?? 15));
            setAutoCancel(settings.autoCancelLate ?? true);
            setTurnover(String(settings.tableTurnoverMinutes ?? 105));
            setDepositOn(settings.depositEnabled ?? false);
            setDepositMin(String(settings.depositMinSize ?? 6));
            setDepositAmount(String(settings.depositAmount ?? 20));
            setOpenHours(structuredClone(settings.openHours ?? {}));
            setRetention(String(settings.retentionMonths ?? 13));
        }
    }, [settings]);

    const flash = useCallback((kind: 'ok' | 'err', text: string) => {
        setMessage({ kind, text });
        window.setTimeout(() => setMessage(null), 4000);
    }, []);

    const handleSaveTicket = async () => {
        setSaving(true);
        try {
            await api.updateSettings({
                avgTicket: Number(avgTicket),
                avgTicketLunch: avgLunch === '' ? null : Number(avgLunch),
                avgTicketDinner: avgDinner === '' ? null : Number(avgDinner),
            });
            await refresh();
            flash('ok', t('settings.ticketSaved'));
        } catch (e) {
            flash('err', e instanceof Error ? e.message : t('settings.saveFailed'));
        } finally {
            setSaving(false);
        }
    };

    const handleSaveGrace = async () => {
        setSavingGrace(true);
        try {
            await api.updateSettings({
                lateGraceMinutes: Number(lateGrace),
                autoCancelLate: autoCancel,
                tableTurnoverMinutes: Number(turnover),
            });
            await refresh();
            flash('ok', t('settings.graceSaved'));
        } catch (e) {
            flash('err', e instanceof Error ? e.message : t('settings.saveFailed'));
        } finally {
            setSavingGrace(false);
        }
    };

    const handleSaveDeposit = async () => {
        const minSize = Number(depositMin);
        if (!Number.isInteger(minSize) || minSize < 2 || minSize > 100) {
            flash('err', t('settings.depositError'));
            return;
        }
        const amount = Number(depositAmount);
        if (!Number.isFinite(amount) || amount < 1 || amount > 500) {
            flash('err', t('settings.depositAmountError'));
            return;
        }
        setSavingRules(true);
        try {
            await api.updateSettings({ depositEnabled: depositOn, depositMinSize: minSize, depositAmount: amount });
            await refresh();
            flash('ok', t('settings.depositSaved'));
        } catch (e) {
            flash('err', e instanceof Error ? e.message : t('settings.saveFailed'));
        } finally {
            setSavingRules(false);
        }
    };

    const handleSaveRetention = async () => {
        const months = Number(retention);
        if (!Number.isInteger(months) || months < 1 || months > 36) {
            flash('err', t('settings.retentionError'));
            return;
        }
        setSavingRetention(true);
        try {
            await api.updateSettings({ retentionMonths: months });
            await refresh();
            flash('ok', t('settings.retentionSaved'));
        } catch (e) {
            flash('err', e instanceof Error ? e.message : t('settings.saveFailed'));
        } finally {
            setSavingRetention(false);
        }
    };

    const handleImageChanged = async () => {
        await refresh();
        flash('ok', t('settings.imageSaved'));
    };

    /** Demo-only refill: wipes + regenerates the demo year (backend enforces demo). */
    const handleSeedDemo = async () => {        if (!window.confirm(t('settings.demoSeedConfirm'))) return;
        setSeedingDemo(true);
        try {
            const res = await api.seedDemo();
            flash('ok', t('settings.demoSeedDone').replace('{n}', String(res.bookings)));
        } catch (e) {
            flash('err', e instanceof Error ? e.message : t('settings.saveFailed'));
        } finally {
            setSeedingDemo(false);
        }
    };

    const previewUrl = fileUrl(settings?.floorPlanImageUrl ?? null);

    /** Locale weekday names starting Sunday (keys 0-6 match the API schedule). */
    const dayNames = Array.from({ length: 7 }, (_, d) =>
        new Intl.DateTimeFormat(lang, { weekday: 'long' }).format(new Date(2026, 9, 4 + d)),
    );

    /** Opening-hours editor (per-day lunch/dinner ranges; absent day = closed). */
    const toggleDay = (day: string) => {
        setOpenHours(prev => {
            const next = { ...prev };
            if (next[day]?.length) delete next[day];
            else next[day] = [{ open: '12:00', close: '14:00' }];
            return next;
        });
    };
    const updateRange = (day: string, i: number, field: 'open' | 'close', value: string) => {
        setOpenHours(prev => ({
            ...prev,
            [day]: (prev[day] ?? []).map((r, j) => (j === i ? { ...r, [field]: value } : r)),
        }));
    };
    const addRange = (day: string) => {
        setOpenHours(prev => ({
            ...prev,
            [day]: [...(prev[day] ?? []), { open: '19:00', close: '23:00' }].slice(0, 2),
        }));
    };
    const removeRange = (day: string, i: number) => {
        setOpenHours(prev => {
            const ranges = (prev[day] ?? []).filter((_, j) => j !== i);
            const next = { ...prev };
            if (ranges.length === 0) delete next[day];
            else next[day] = ranges;
            return next;
        });
    };
    const handleSaveHours = async () => {
        setSavingHours(true);
        try {
            await api.updateSettings({ openHours });
            await refresh();
            flash('ok', t('settings.openHoursSaved'));
        } catch (e) {
            flash('err', e instanceof Error ? e.message : t('settings.saveFailed'));
        } finally {
            setSavingHours(false);
        }
    };

    // Staff sees live ops only — every control on this page is owner-level.
    // Header stays the shared AppShell one; only the body differs.
    if (!roleLoading && role === 'STAFF') {
        return (
            <div className="flex flex-col gap-4">
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-700/60 shadow-xl dark:shadow-none text-center">
                        <p className="text-sm font-black text-slate-700 dark:text-slate-200">{t('team.deniedTitle')}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-1">{t('team.deniedMsg')}</p>
                    </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
                <p className="text-slate-500 dark:text-slate-400 font-bold text-xs lg:text-sm">{t('settings.subtitle')}</p>

                {message && (
                    <div className={cn(
                        "px-4 py-3 rounded-2xl text-sm font-bold border",
                        message.kind === 'ok'
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-red-50 text-red-600 border-red-200"
                    )}>
                        {message.text}
                    </div>
                )}

                {/* Average ticket */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-700/60 shadow-xl shadow-slate-200/50 dark:shadow-none">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <Euro className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{t('settings.ticketTitle')}</h2>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-4">
                        {t('settings.ticketMsg')}
                    </p>
                    {loading ? (
                        <div className="h-11 w-40 bg-slate-100 rounded-xl animate-pulse" />
                    ) : (
                        <div className="flex flex-col gap-4">
                            <SettingsField label={t('settings.ticketLabel')} unit="€" hint={t('settings.ticketHint')}>
                                {(id) => (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <input
                                            id={id}
                                            aria-describedby={`${id}-hint`}
                                            type="number"
                                            min={1}
                                            max={1000}
                                            step={0.5}
                                            value={avgTicket}
                                            onChange={e => setAvgTicket(e.target.value)}
                                            placeholder="45"
                                            className="w-40 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                                        />
                                        <button
                                            onClick={handleSaveTicket}
                                            disabled={saving}
                                            className="min-h-[44px] bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                                        >
                                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            {saving ? t('common.saving') : t('common.save')}
                                        </button>
                                    </div>
                                )}
                            </SettingsField>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <SettingsField label={t('settings.ticketLunchLabel')} unit="€" hint={t('settings.ticketSplitMsg')}>
                                    {(id) => (
                                        <input
                                            id={id}
                                            type="number"
                                            min={1}
                                            max={1000}
                                            step={0.5}
                                            value={avgLunch}
                                            onChange={e => setAvgLunch(e.target.value)}
                                            placeholder="—"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                        />
                                    )}
                                </SettingsField>
                                <SettingsField label={t('settings.ticketDinnerLabel')} unit="€" hint={t('settings.ticketSplitMsg')}>
                                    {(id) => (
                                        <input
                                            id={id}
                                            type="number"
                                            min={1}
                                            max={1000}
                                            step={0.5}
                                            value={avgDinner}
                                            onChange={e => setAvgDinner(e.target.value)}
                                            placeholder="—"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                        />
                                    )}
                                </SettingsField>
                            </div>
                        </div>
                    )}
                </div>

                {/* Late tolerance */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-700/60 shadow-xl shadow-slate-200/50 dark:shadow-none">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                            <Timer className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{t('settings.graceTitle')}</h2>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-4">
                        {t('settings.graceMsg')}
                    </p>
                    {loading ? (
                        <div className="h-11 w-40 bg-slate-100 rounded-xl animate-pulse" />
                    ) : (
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => setAutoCancel(v => !v)}
                                className="flex items-center gap-3 cursor-pointer text-left"
                            >
                                <span className={cn(
                                    "w-11 h-6 rounded-full p-0.5 transition-colors shrink-0",
                                    autoCancel ? "bg-emerald-500" : "bg-slate-200",
                                )}>
                                    <span className={cn(
                                        "block w-5 h-5 rounded-full bg-white shadow transition-transform",
                                        autoCancel && "translate-x-5",
                                    )} />
                                </span>
                                <span className="text-sm font-black text-slate-900">{t('settings.autoCancelTitle')}</span>
                            </button>
                            <SettingsField label={t('settings.graceLabel')} unit="min" hint={t('settings.graceHint')}>
                                {(id) => (
                                    <div className="flex gap-2">
                                        <input
                                            id={id}
                                            aria-describedby={`${id}-hint`}
                                            type="number"
                                            min={0}
                                            max={120}
                                            step={1}
                                            value={lateGrace}
                                            onChange={e => setLateGrace(e.target.value)}
                                            placeholder="15"
                                            className="w-40 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                                        />
                                        <button
                                            onClick={handleSaveGrace}
                                            disabled={savingGrace}
                                            className="min-h-[44px] bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                                        >
                                            {savingGrace ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            {savingGrace ? t('common.saving') : t('common.save')}
                                        </button>
                                    </div>
                                )}
                            </SettingsField>
                            <SettingsField label={t('settings.turnoverLabel')} unit="min" hint={t('settings.turnoverHint')}>
                                {(id) => (
                                    <input
                                        id={id}
                                        aria-describedby={`${id}-hint`}
                                        type="number"
                                        min={30}
                                        max={300}
                                        step={5}
                                        value={turnover}
                                        onChange={e => setTurnover(e.target.value)}
                                        placeholder="105"
                                        className="w-40 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                                    />
                                )}
                            </SettingsField>
                        </div>
                    )}
                </div>

                {/* Card hold for large parties */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-700/60 shadow-xl shadow-slate-200/50 dark:shadow-none">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center">
                            <CreditCard className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{t('settings.depositTitle')}</h2>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-4">
                        {t('settings.depositMsg')}
                    </p>
                    {loading ? (
                        <div className="h-11 w-40 bg-slate-100 rounded-xl animate-pulse" />
                    ) : (
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => setDepositOn(v => !v)}
                                className="flex items-center gap-3 cursor-pointer text-left"
                            >
                                <span className={cn(
                                    "w-11 h-6 rounded-full p-0.5 transition-colors shrink-0",
                                    depositOn ? "bg-emerald-500" : "bg-slate-200",
                                )}>
                                    <span className={cn(
                                        "block w-5 h-5 rounded-full bg-white shadow transition-transform",
                                        depositOn && "translate-x-5",
                                    )} />
                                </span>
                                <span className="text-sm font-black text-slate-900">{t('settings.depositToggle')}</span>
                            </button>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <SettingsField label={t('settings.depositMinLabel')} unit="guests" hint={t('settings.depositMinHint')}>
                                    {(id) => (
                                        <input
                                            id={id}
                                            type="number"
                                            min={2}
                                            max={100}
                                            step={1}
                                            value={depositMin}
                                            onChange={e => setDepositMin(e.target.value)}
                                            disabled={!depositOn}
                                            placeholder="6"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 disabled:opacity-50"
                                        />
                                    )}
                                </SettingsField>
                                <SettingsField label={t('settings.depositAmountLabel')} unit="€" hint={t('settings.depositAmountHint')}>
                                    {(id) => (
                                        <input
                                            id={id}
                                            type="number"
                                            min={1}
                                            max={500}
                                            step={1}
                                            value={depositAmount}
                                            onChange={e => setDepositAmount(e.target.value)}
                                            disabled={!depositOn}
                                            placeholder="20"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 disabled:opacity-50"
                                        />
                                    )}
                                </SettingsField>
                            </div>
                            <div>
                                <button
                                    onClick={handleSaveDeposit}
                                    disabled={savingRules}
                                    className="min-h-[44px] bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                                >
                                    {savingRules ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {savingRules ? t('common.saving') : t('common.save')}
                                </button>
                            </div>
                            <StripeConnectBlock refresh={refresh} flash={flash} />
                        </div>
                    )}
                </div>

                {/* Opening hours (public widget grid + booking guard) */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-700/60 shadow-xl shadow-slate-200/50 dark:shadow-none">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <Clock className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{t('settings.openHoursTitle')}</h2>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">
                        {t('settings.openHoursMsg')}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mb-4">
                        {t('settings.openHoursHint')}
                    </p>
                    {loading ? (
                        <div className="h-11 w-40 bg-slate-100 rounded-xl animate-pulse" />
                    ) : (
                        <div className="flex flex-col gap-2">
                            {dayNames.map((name, d) => {
                                const key = String(d);
                                const ranges = openHours[key] ?? [];
                                const closed = ranges.length === 0;
                                return (
                                    <div key={key} className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 border border-slate-200 px-3 py-2">
                                        <button
                                            onClick={() => toggleDay(key)}
                                            className="flex items-center gap-2 cursor-pointer min-w-28 text-left"
                                            aria-pressed={!closed}
                                        >
                                            <span className={cn(
                                                "w-9 h-5 rounded-full p-0.5 transition-colors shrink-0",
                                                closed ? "bg-slate-200" : "bg-emerald-500",
                                            )}>
                                                <span className={cn(
                                                    "block w-4 h-4 rounded-full bg-white shadow transition-transform",
                                                    !closed && "translate-x-4",
                                                )} />
                                            </span>
                                            <span className="text-sm font-black text-slate-900 capitalize">{name}</span>
                                        </button>
                                        {closed ? (
                                            <span className="text-xs font-bold text-slate-400">{t('settings.dayClosed')}</span>
                                        ) : (
                                            <div className="flex flex-wrap items-center gap-2">
                                                {ranges.map((r, i) => (
                                                    <div key={i} className="flex items-center gap-1">
                                                        <input
                                                            type="time"
                                                            value={r.open}
                                                            onChange={e => updateRange(key, i, 'open', e.target.value)}
                                                            aria-label={`${name} open ${i + 1}`}
                                                            className="bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                                        />
                                                        <span className="text-slate-400 font-black">–</span>
                                                        <input
                                                            type="time"
                                                            value={r.close}
                                                            onChange={e => updateRange(key, i, 'close', e.target.value)}
                                                            aria-label={`${name} close ${i + 1}`}
                                                            className="bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                                        />
                                                        {ranges.length > 1 && (
                                                            <button
                                                                onClick={() => removeRange(key, i)}
                                                                aria-label={t('settings.removeRange')}
                                                                className="text-slate-400 hover:text-red-600 font-black px-1 cursor-pointer"
                                                            >
                                                                ×
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                {ranges.length < 2 && (
                                                    <button
                                                        onClick={() => addRange(key)}
                                                        className="text-xs font-black text-indigo-600 hover:text-indigo-800 cursor-pointer"
                                                    >
                                                        + {t('settings.addRange')}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            <button
                                onClick={handleSaveHours}
                                disabled={savingHours}
                                className="mt-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50 cursor-pointer self-start"
                            >
                                {savingHours ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {savingHours ? t('common.saving') : t('common.save')}
                            </button>
                        </div>
                    )}
                </div>

                {/* Data retention (GDPR) */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-700/60 shadow-xl shadow-slate-200/50 dark:shadow-none">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{t('settings.retentionTitle')}</h2>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-4">
                        {t('settings.retentionMsg')}
                    </p>
                    {loading ? (
                        <div className="h-11 w-40 bg-slate-100 rounded-xl animate-pulse" />
                    ) : (
                        <SettingsField label={t('settings.retentionLabel')} unit="months" hint={t('settings.retentionHint')}>
                            {(id) => (
                                <div className="flex gap-2 items-center">
                                    <input
                                        id={id}
                                        aria-describedby={`${id}-hint`}
                                        type="number"
                                        min={1}
                                        max={36}
                                        step={1}
                                        value={retention}
                                        onChange={e => setRetention(e.target.value)}
                                        placeholder="13"
                                        className="w-40 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:border-slate-500"
                                    />
                                    <button
                                        onClick={handleSaveRetention}
                                        disabled={savingRetention}
                                        className="min-h-[44px] bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                                    >
                                        {savingRetention ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        {savingRetention ? t('common.saving') : t('common.save')}
                                    </button>
                                </div>
                            )}
                        </SettingsField>
                    )}
                </div>

                {/* Team (owner) */}
                <TeamCard flash={flash} />

                {/* Seating chart image */}                <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-700/60 shadow-xl shadow-slate-200/50 dark:shadow-none">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <ImageIcon className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{t('settings.imageTitle')}</h2>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-4">
                        {t('settings.imageMsg')}
                    </p>
                    <FloorPlanImageDropzone previewUrl={previewUrl} onChanged={handleImageChanged} />
                </div>

                {/* Floor plan editor */}
                <Link
                    to="/app/floor-plan"
                    className="bg-slate-900 rounded-[2rem] p-6 shadow-xl flex items-center gap-4 hover:bg-slate-800 active:scale-[0.99] transition-all group"
                >
                    <div className="w-10 h-10 rounded-2xl bg-white/10 text-indigo-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <MapIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-white tracking-tight">{t('settings.editorTitle')}</h2>
                        <p className="text-xs text-slate-400 font-medium">{t('settings.editorMsg')}</p>
                    </div>
                </Link>

                {/* Demo-only database refill (demo JWT session, not slug-compared:
                    the sandbox slug is not guaranteed to stay literally 'demo'). */}
                {isDemoSession() && (
                    <div className="bg-violet-50 rounded-[2rem] p-6 border border-violet-200 shadow-xl shadow-violet-100">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-10 h-10 rounded-2xl bg-violet-600 text-white flex items-center justify-center">
                                <DatabaseBackup className="w-5 h-5" />
                            </div>
                            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{t('settings.demoSeedTitle')}</h2>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-4">
                            {t('settings.demoSeedMsg')}
                        </p>
                        <button
                            onClick={handleSeedDemo}
                            disabled={seedingDemo}
                            className="min-h-[48px] bg-violet-600 hover:bg-violet-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                        >
                            {seedingDemo ? <Loader2 className="w-4 h-4 animate-spin" /> : <DatabaseBackup className="w-4 h-4" />}
                            {seedingDemo ? t('settings.demoSeeding') : t('settings.demoSeedBtn')}
                        </button>
                    </div>
                )}
        </div>
    );
};
