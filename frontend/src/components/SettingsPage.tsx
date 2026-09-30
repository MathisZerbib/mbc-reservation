import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Save, Euro, Image as ImageIcon, Map as MapIcon, Loader2, Timer, CreditCard } from 'lucide-react';
import { api, fileUrl } from '../services/api';
import { useRestaurantSettings } from '../hooks/useFloorPlan';
import { FloorPlanImageDropzone } from './FloorPlanImageDropzone';
import { useTranslation } from '../i18n/useTranslation';
import { cn } from '../lib/utils';

export const SettingsPage: React.FC = () => {
    const { t } = useTranslation();
    const { settings, loading, refresh } = useRestaurantSettings();
    const [avgTicket, setAvgTicket] = useState('');
    const [lateGrace, setLateGrace] = useState('');
    const [autoCancel, setAutoCancel] = useState(true);
    const [depositOn, setDepositOn] = useState(false);
    const [depositMin, setDepositMin] = useState('6');
    const [saving, setSaving] = useState(false);
    const [savingGrace, setSavingGrace] = useState(false);
    const [savingRules, setSavingRules] = useState(false);
    const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

    useEffect(() => {
        if (settings) {
            setAvgTicket(String(settings.avgTicket));
            setLateGrace(String(settings.lateGraceMinutes ?? 15));
            setAutoCancel(settings.autoCancelLate ?? true);
            setDepositOn(settings.depositEnabled ?? false);
            setDepositMin(String(settings.depositMinSize ?? 6));
        }
    }, [settings]);

    const flash = (kind: 'ok' | 'err', text: string) => {
        setMessage({ kind, text });
        window.setTimeout(() => setMessage(null), 4000);
    };

    const handleSaveTicket = async () => {
        setSaving(true);
        try {
            await api.updateSettings({ avgTicket: Number(avgTicket) });
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
            await api.updateSettings({ lateGraceMinutes: Number(lateGrace), autoCancelLate: autoCancel });
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
        setSavingRules(true);
        try {
            await api.updateSettings({ depositEnabled: depositOn, depositMinSize: minSize });
            await refresh();
            flash('ok', t('settings.depositSaved'));
        } catch (e) {
            flash('err', e instanceof Error ? e.message : t('settings.saveFailed'));
        } finally {
            setSavingRules(false);
        }
    };

    const handleImageChanged = async () => {
        await refresh();
        flash('ok', t('settings.imageSaved'));
    };

    const previewUrl = fileUrl(settings?.floorPlanImageUrl ?? null);

    return (
        <div className="min-h-screen bg-slate-100 p-4 lg:p-8">
            <div className="max-w-3xl mx-auto flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <Link to="/app/dashboard" className="p-2.5 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-slate-900 transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight leading-none">{t('settings.title')}</h1>
                        <p className="text-slate-500 font-bold text-xs lg:text-sm mt-1">{t('settings.subtitle')}</p>
                    </div>
                </div>

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
                <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-xl shadow-slate-200/50">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <Euro className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-black text-slate-900 tracking-tight">{t('settings.ticketTitle')}</h2>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mb-4">
                        {t('settings.ticketMsg')}
                    </p>
                    {loading ? (
                        <div className="h-11 w-40 bg-slate-100 rounded-xl animate-pulse" />
                    ) : (
                        <div className="flex gap-2">
                            <input
                                type="number"
                                min={1}
                                max={1000}
                                step={0.5}
                                value={avgTicket}
                                onChange={e => setAvgTicket(e.target.value)}
                                className="w-40 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                            />
                            <button
                                onClick={handleSaveTicket}
                                disabled={saving}
                                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {saving ? t('common.saving') : t('common.save')}
                            </button>
                        </div>
                    )}
                </div>

                {/* Late tolerance */}
                <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-xl shadow-slate-200/50">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                            <Timer className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-black text-slate-900 tracking-tight">{t('settings.graceTitle')}</h2>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mb-4">
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
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    min={0}
                                    max={120}
                                    step={1}
                                    value={lateGrace}
                                    onChange={e => setLateGrace(e.target.value)}
                                    className="w-40 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                                />
                                <button
                                    onClick={handleSaveGrace}
                                    disabled={savingGrace}
                                    className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                                >
                                    {savingGrace ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {savingGrace ? t('common.saving') : t('common.save')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Card hold for large parties */}
                <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-xl shadow-slate-200/50">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center">
                            <CreditCard className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-black text-slate-900 tracking-tight">{t('settings.depositTitle')}</h2>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mb-4">
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
                            <div className="flex gap-2 items-center">
                                <input
                                    type="number"
                                    min={2}
                                    max={100}
                                    step={1}
                                    value={depositMin}
                                    onChange={e => setDepositMin(e.target.value)}
                                    disabled={!depositOn}
                                    className="w-40 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 disabled:opacity-50"
                                />
                                <button
                                    onClick={handleSaveDeposit}
                                    disabled={savingRules}
                                    className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                                >
                                    {savingRules ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {savingRules ? t('common.saving') : t('common.save')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Seating chart image */}
                <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-xl shadow-slate-200/50">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <ImageIcon className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-black text-slate-900 tracking-tight">{t('settings.imageTitle')}</h2>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mb-4">
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
            </div>
        </div>
    );
};
