import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check, Copy, Loader2, PartyPopper, Store, Euro, LayoutGrid, ImagePlus, type LucideIcon } from 'lucide-react';
import { api, fileUrl } from '../services/api';
import { useRestaurantSettings, useTenant } from '../hooks/useFloorPlan';
import { useTranslation } from '../i18n/useTranslation';
import { LangToggle } from './LangToggle';
import type { LayoutTable } from '../types/index';
import { cn } from '../lib/utils';

const stepVariants = {
    enter: (direction: number) => ({ x: direction > 0 ? 60 : -60, opacity: 0, scale: 0.98, filter: 'blur(6px)' }),
    center: { x: 0, opacity: 1, scale: 1, filter: 'blur(0px)' },
    exit: (direction: number) => ({ x: direction > 0 ? -60 : 60, opacity: 0, scale: 0.98, filter: 'blur(6px)' }),
};

/** Grid of 2-top tables used by the quick-add presets. */
const gridTables = (count: number): LayoutTable[] => {
    const cols = 8;
    return Array.from({ length: count }, (_, i) => ({
        id: -(i + 1),
        name: String(i + 1),
        capacity: 2,
        type: 'RECTANGULAR' as const,
        x: 50 + (i % cols) * 110,
        y: 80 + Math.floor(i / cols) * 130,
        width: 60,
        height: 80,
        rotation: 0,
        adjacentNames: [],
    }));
};

export const OnboardingPage: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { tenant, refresh: refreshTenant } = useTenant();
    const { settings, refresh: refreshSettings } = useRestaurantSettings();
    const [step, setStep] = useState(0);
    const [direction, setDirection] = useState(1);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const [name, setName] = useState('');
    const [avgTicket, setAvgTicket] = useState('');
    const [tablesChoice, setTablesChoice] = useState<number | null>(null);

    const STEPS = [t('onboarding.s1'), t('onboarding.s2'), t('onboarding.s3'), t('onboarding.s4'), t('onboarding.s5')];
    const PRESETS = [
        { label: t('onboarding.intimate'), desc: t('onboarding.intimateDesc'), count: 12 },
        { label: t('onboarding.classic'), desc: t('onboarding.classicDesc'), count: 24 },
        { label: t('onboarding.grand'), desc: t('onboarding.grandDesc'), count: 40 },
    ];

    useEffect(() => {
        if (tenant && !name) setName(tenant.name);
    }, [tenant, name]);
    useEffect(() => {
        if (settings && !avgTicket) setAvgTicket(String(settings.avgTicket));
    }, [settings, avgTicket]);

    const go = (next: number) => {
        setDirection(next > step ? 1 : -1);
        setStep(next);
        setError(null);
    };

    const bookingUrl = tenant ? `${window.location.origin}/b/${tenant.slug}` : '';

    const saveWelcome = async () => {
        if (name.trim().length < 2) {
            setError(t('onboarding.nameError'));
            return;
        }
        setSaving(true);
        try {
            await api.updateTenant({ name: name.trim() });
            await refreshTenant();
            go(1);
        } catch (e) {
            setError(e instanceof Error ? e.message : t('onboarding.saveError'));
        } finally {
            setSaving(false);
        }
    };

    const saveService = async () => {
        const value = Number(avgTicket);
        if (!Number.isFinite(value) || value < 1 || value > 1000) {
            setError(t('onboarding.ticketError'));
            return;
        }
        setSaving(true);
        try {
            await api.updateSettings({ avgTicket: value });
            await refreshSettings();
            go(2);
        } catch (e) {
            setError(e instanceof Error ? e.message : t('onboarding.saveError'));
        } finally {
            setSaving(false);
        }
    };

    const saveTables = async (count: number | null) => {
        setSaving(true);
        try {
            if (count !== null) {
                // Strip client-side temp ids (negative) so the backend
                // upserts newcomers by name — same convention as the editor.
                const payload = gridTables(count).map(({ id: _tempId, ...rest }) => rest);
                await api.saveLayout(payload, []);
                setTablesChoice(count);
            }
            go(3);
        } catch (e) {
            setError(e instanceof Error ? e.message : t('onboarding.createError'));
        } finally {
            setSaving(false);
        }
    };

    const uploadImage = async (file: File | undefined) => {
        if (!file) return;
        setSaving(true);
        try {
            await api.uploadFloorPlanImage(file);
            await refreshSettings();
        } catch (e) {
            setError(e instanceof Error ? e.message : t('onboarding.uploadError'));
        } finally {
            setSaving(false);
        }
    };

    const finish = async () => {
        setSaving(true);
        try {
            await api.updateTenant({ onboardingComplete: true });
            await refreshTenant();
            navigate('/app/dashboard');
        } catch (e) {
            setError(e instanceof Error ? e.message : t('onboarding.finishError'));
            setSaving(false);
        }
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(bookingUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setError(t('onboarding.copyFail'));
        }
    };

    const shell = (children: React.ReactNode) => (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 relative">
            <div className="absolute top-4 right-4">
                <LangToggle />
            </div>
            <div className="w-full max-w-2xl">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                        Faci<span className="text-indigo-500">-</span>Table <span className="text-slate-400 font-bold">{t('onboarding.setup')}</span>
                    </h1>
                    <div className="flex items-center justify-center gap-2 mt-4" aria-hidden="true">
                        {STEPS.map((label, i) => (
                            <div
                                key={label}
                                className={cn(
                                    "h-2 rounded-full transition-all duration-500",
                                    i < step ? "w-6 bg-emerald-500" : i === step ? "w-10 bg-indigo-600" : "w-6 bg-slate-200"
                                )}
                            />
                        ))}
                    </div>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-2">
                        {t('onboarding.stepOf').replace('{a}', String(step + 1)).replace('{b}', String(STEPS.length))} · {STEPS[step]}
                    </p>
                </div>
                <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200 p-6 lg:p-10 overflow-hidden">
                    <AnimatePresence mode="wait" custom={direction}>
                        <motion.div
                            key={step}
                            custom={direction}
                            variants={stepVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                        >
                            {children}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );

    if (!tenant) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    const Nav = ({ onBack, onNext, nextLabel, hideNext = false }: {
        onBack?: () => void; onNext?: () => void; nextLabel?: string; hideNext?: boolean;
    }) => (
        <div className="flex items-center justify-between mt-8">
            {onBack ? (
                <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">
                    <ChevronLeft className="w-4 h-4" /> {t('common.back')}
                </button>
            ) : <span />}
            {!hideNext && (
                <button
                    onClick={onNext}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{nextLabel ?? t('common.continue')} <ChevronRight className="w-4 h-4" /></>}
                </button>
            )}
        </div>
    );

    const stepIcon = (Icon: LucideIcon, bg: string, fg: string) => (
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4", bg, fg)}>
            <Icon className="w-6 h-6" />
        </div>
    );

    if (step === 0) return shell(
        <div>
            {stepIcon(PartyPopper, 'bg-indigo-50', 'text-indigo-600')}
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t('onboarding.welcomeTitle')}</h2>
            <p className="text-sm text-slate-500 font-medium mt-2">
                {t('onboarding.welcomeMsg').replace('{name}', tenant.name)}
            </p>
            <label className="block mt-6">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{t('onboarding.nameLabel')}</span>
                <input
                    type="text"
                    value={name}
                    maxLength={60}
                    onChange={e => setName(e.target.value)}
                    className="mt-1.5 w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
            </label>
            <p className="text-xs text-slate-400 font-medium mt-2">{t('onboarding.bookingAt')} <span className="font-bold text-indigo-600">/b/{tenant.slug}</span></p>
            {error && <p className="text-sm font-bold text-red-500 mt-3">{error}</p>}
            <Nav onNext={saveWelcome} nextLabel={t('onboarding.startSetup')} />
        </div>
    );

    if (step === 1) return shell(
        <div>
            {stepIcon(Euro, 'bg-emerald-50', 'text-emerald-600')}
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t('onboarding.serviceTitle')}</h2>
            <p className="text-sm text-slate-500 font-medium mt-2">{t('onboarding.serviceMsg')}</p>
            <div className="flex items-center gap-2 mt-6">
                <input
                    type="number"
                    min={1}
                    max={1000}
                    step={0.5}
                    value={avgTicket}
                    onChange={e => setAvgTicket(e.target.value)}
                    className="w-40 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                <span className="text-lg font-black text-slate-400">{t('onboarding.ticketLabel')}</span>
            </div>
            {error && <p className="text-sm font-bold text-red-500 mt-3">{error}</p>}
            <Nav onBack={() => go(0)} onNext={saveService} />
        </div>
    );

    if (step === 2) return shell(
        <div>
            {stepIcon(LayoutGrid, 'bg-amber-50', 'text-amber-600')}
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t('onboarding.tablesTitle')}</h2>
            <p className="text-sm text-slate-500 font-medium mt-2">{t('onboarding.tablesMsg')}</p>
            <div className="grid sm:grid-cols-3 gap-3 mt-6">
                {PRESETS.map(p => (
                    <button
                        key={p.label}
                        onClick={() => saveTables(p.count)}
                        disabled={saving}
                        className={cn(
                            "p-4 rounded-2xl border-2 text-left transition-all active:scale-95 cursor-pointer disabled:opacity-50",
                            tablesChoice === p.count
                                ? "border-indigo-500 bg-indigo-50/50 shadow-lg shadow-indigo-500/10"
                                : "border-slate-100 bg-white hover:border-indigo-200 hover:shadow-xl"
                        )}
                    >
                        <span className="block text-base font-black text-slate-900">{p.label}</span>
                        <span className="block text-xs text-slate-400 font-medium mt-1">{p.desc}</span>
                    </button>
                ))}
            </div>
            {error && <p className="text-sm font-bold text-red-500 mt-3">{error}</p>}
            <div className="flex items-center justify-between mt-8">
                <button onClick={() => go(1)} className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">
                    <ChevronLeft className="w-4 h-4" /> {t('common.back')}
                </button>
                <div className="flex items-center gap-3">
                    <button onClick={() => saveTables(null)} disabled={saving} className="text-sm font-bold text-slate-400 hover:text-slate-700 transition-colors cursor-pointer disabled:opacity-50">
                        {t('onboarding.later')}
                    </button>
                    <Link to="/app/floor-plan" className="inline-flex items-center gap-1.5 bg-slate-900 text-white px-5 py-3 rounded-2xl font-bold text-sm active:scale-95 transition-all">
                        {t('onboarding.openEditor')} <ChevronRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        </div>
    );

    if (step === 3) return shell(
        <div>
            {stepIcon(ImagePlus, 'bg-violet-50', 'text-violet-600')}
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {t('onboarding.imageTitle')} <span className="text-slate-300 font-bold">{t('onboarding.optional')}</span>
            </h2>
            <p className="text-sm text-slate-500 font-medium mt-2">{t('onboarding.imageMsg')}</p>
            {fileUrl(settings?.floorPlanImageUrl ?? null) ? (
                <img
                    src={fileUrl(settings?.floorPlanImageUrl ?? null) ?? ''}
                    alt={t('onboarding.imageTitle')}
                    className="w-full max-h-56 object-contain bg-slate-50 rounded-2xl border border-slate-100 mt-6"
                />
            ) : (
                <label className="mt-6 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl py-10 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all">
                    <ImagePlus className="w-8 h-8 text-slate-300 mb-2" />
                    <span className="text-sm font-bold text-slate-500">{saving ? t('onboarding.uploading') : t('onboarding.uploadCta')}</span>
                    <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={saving}
                        onChange={e => { uploadImage(e.target.files?.[0]); e.target.value = ''; }}
                    />
                </label>
            )}
            {error && <p className="text-sm font-bold text-red-500 mt-3">{error}</p>}
            <Nav onBack={() => go(2)} onNext={() => go(4)} />
        </div>
    );

    return shell(
        <div>
            {stepIcon(Store, 'bg-emerald-50', 'text-emerald-600')}
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t('onboarding.goLiveTitle')}</h2>
            <p className="text-sm text-slate-500 font-medium mt-2">{t('onboarding.goLiveMsg')}</p>
            <div className="flex items-center gap-2 mt-6 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
                <span className="flex-1 text-sm font-bold text-indigo-700 truncate">{bookingUrl}</span>
                <button onClick={copyLink} className="inline-flex items-center gap-1.5 text-xs font-black text-slate-500 hover:text-indigo-600 uppercase tracking-wider cursor-pointer">
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    {copied ? t('common.copied') : t('common.copy')}
                </button>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-100 divide-y divide-slate-50">
                {[
                    [t('onboarding.checkProfile'), true],
                    [t('onboarding.checkTicket'), avgTicket !== ''],
                    [tablesChoice ? t('onboarding.checkTablesDone').replace('{n}', String(tablesChoice)) : t('onboarding.checkTables'), tablesChoice !== null],
                    [t('onboarding.checkImage'), !!settings?.floorPlanImageUrl],
                ].map(([label, done]) => (
                    <div key={label as string} className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-slate-600">
                        <span className={cn("w-5 h-5 rounded-full flex items-center justify-center", done ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-300")}>
                            <Check className="w-3 h-3" />
                        </span>
                        {label}
                    </div>
                ))}
            </div>
            {error && <p className="text-sm font-bold text-red-500 mt-3">{error}</p>}
            <div className="flex items-center justify-between mt-8">
                <button onClick={() => go(3)} className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">
                    <ChevronLeft className="w-4 h-4" /> {t('common.back')}
                </button>
                <button
                    onClick={finish}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> {t('onboarding.openDashboard')}</>}
                </button>
            </div>
        </div>
    );
};
