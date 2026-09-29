import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
    Sparkles,
    Smartphone,
    Zap,
    type LucideIcon,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { useTranslation, type TranslationKey } from '../i18n/useTranslation';
import { DEFAULT_TENANT_SLUG } from '../utils/tenant';
import { BookingWidget } from '../components/BookingWidget';
import { useBackendWake } from '../hooks/useBackendStatus';
import { cn } from '../lib/utils';

/* ------------------------------------------------------------------ */
/* Local data — i18n keys resolved at render through t()              */
/* ------------------------------------------------------------------ */

interface FeatureItem {
    icon: LucideIcon;
    titleKey: TranslationKey;
    descKey: TranslationKey;
}

interface StepItem {
    titleKey: TranslationKey;
    descKey: TranslationKey;
}

const FEATURES: FeatureItem[] = [
    { icon: Zap, titleKey: 'landing.features.realtime.title', descKey: 'landing.features.realtime.desc' },
    { icon: Sparkles, titleKey: 'landing.features.smart.title', descKey: 'landing.features.smart.desc' },
    { icon: Smartphone, titleKey: 'landing.features.mobile.title', descKey: 'landing.features.mobile.desc' },
];

const STEPS: StepItem[] = [
    { titleKey: 'landing.how.step1.title', descKey: 'landing.how.step1.desc' },
    { titleKey: 'landing.how.step2.title', descKey: 'landing.how.step2.desc' },
    { titleKey: 'landing.how.step3.title', descKey: 'landing.how.step3.desc' },
];

/* ------------------------------------------------------------------ */
/* Shared animation variants (purposeful, not over-animated)          */
/* ------------------------------------------------------------------ */

const EASE_OUT = 'easeOut' as const;

const fadeUp: Variants = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

const stagger: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.12 } },
};

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

const Hero = () => {
    const { t } = useTranslation();

    return (
        <section className="relative flex min-h-svh flex-col overflow-hidden bg-slate-950 text-white">
            {/* Decorative background: brand blobs + dot grid */}
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                <div className="absolute -top-40 -left-32 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl" />
                <div className="absolute top-1/3 -right-40 h-[28rem] w-[28rem] rounded-full bg-emerald-500/10 blur-3xl" />
                <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:28px_28px]" />
            </div>

            <motion.div
                variants={stagger}
                initial="hidden"
                animate="visible"
                className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 py-24 text-center sm:px-6"
            >
                <motion.span
                    variants={fadeUp}
                    className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-indigo-300"
                >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Restaurant reservations · real-time
                </motion.span>

                <motion.h1
                    variants={fadeUp}
                    className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl"
                >
                    {t('landing.hero.title')}
                </motion.h1>

                <motion.p
                    variants={fadeUp}
                    className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg"
                >
                    {t('landing.hero.subtitle')}
                </motion.p>

                <motion.div
                    variants={fadeUp}
                    className="mt-9 flex flex-col items-center gap-4 sm:flex-row"
                >
                    <Button
                        asChild
                        size="lg"
                        className="h-12 rounded-2xl bg-indigo-500 px-8 text-base font-black text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400"
                    >
                        <Link to="/register">
                            {t('landing.hero.trial')}
                        </Link>
                    </Button>
                    <a
                        href="#features"
                        className="text-sm font-bold text-slate-200 underline-offset-4 transition-colors hover:text-white hover:underline"
                    >
                        {t('landing.hero.cta')} →
                    </a>
                    <Link
                        to={`/${DEFAULT_TENANT_SLUG}`}
                        className="text-sm font-bold text-slate-200 underline-offset-4 transition-colors hover:text-white hover:underline"
                    >
                        {t('landing.hero.book')} →
                    </Link>
                    <Link
                        to="/login"
                        className="text-sm font-bold text-slate-400 transition-colors hover:text-white"
                    >
                        {t('landing.hero.login')} →
                    </Link>
                </motion.div>
            </motion.div>
        </section>
    );
};

/* ------------------------------------------------------------------ */
/* Features — 3 cards in a responsive grid                            */
/* ------------------------------------------------------------------ */

const Features = () => {
    const { t } = useTranslation();

    return (
        <section id="features" className="bg-slate-50 py-20 sm:py-24">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                <motion.div
                    variants={stagger}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-80px' }}
                    className="mx-auto max-w-2xl text-center"
                >
                    <motion.h2
                        variants={fadeUp}
                        className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl"
                    >
                        {t('landing.features.title')}
                    </motion.h2>
                    <motion.p variants={fadeUp} className="mt-3 text-slate-500">
                        {t('landing.features.subtitle')}
                    </motion.p>
                </motion.div>

                <motion.div
                    variants={stagger}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-80px' }}
                    className="mt-12 grid gap-6 md:grid-cols-3"
                >
                    {FEATURES.map(({ icon: Icon, titleKey, descKey }) => (
                        <motion.div key={titleKey} variants={fadeUp}>
                            <Card className="h-full rounded-3xl p-6 transition-all hover:shadow-xl hover:-translate-y-1">
                                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                                    <Icon className="h-5 w-5" aria-hidden="true" />
                                </div>
                                <h3 className="text-lg font-black text-slate-900">{t(titleKey)}</h3>
                                <p className="mt-2 text-sm leading-relaxed text-slate-500">{t(descKey)}</p>
                            </Card>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
};

/* ------------------------------------------------------------------ */
/* How it works — 3-step timeline, sequential whileInView              */
/* ------------------------------------------------------------------ */

const HowItWorks = () => {
    const { t } = useTranslation();

    return (
        <section className="bg-white py-20 sm:py-24">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                <motion.div
                    variants={stagger}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-80px' }}
                    className="mx-auto max-w-2xl text-center"
                >
                    <motion.h2
                        variants={fadeUp}
                        className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl"
                    >
                        {t('landing.how.title')}
                    </motion.h2>
                </motion.div>

                <motion.ol
                    variants={stagger}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-80px' }}
                    className="relative mt-14 grid gap-10 md:grid-cols-3"
                >
                    {/* Connector line (desktop only) */}
                    <span
                        aria-hidden="true"
                        className="pointer-events-none absolute left-[16.66%] right-[16.66%] top-6 hidden h-px bg-slate-200 md:block"
                    />
                    {STEPS.map((step, index) => (
                        <motion.li
                            key={step.titleKey}
                            variants={fadeUp}
                            className="relative flex flex-col items-center text-center"
                        >
                            <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-slate-900 text-sm font-black text-white shadow-md">
                                {index + 1}
                            </span>
                            <h3 className="mt-4 text-lg font-black text-slate-900">
                                {t(step.titleKey)}
                            </h3>
                            <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
                                {t(step.descKey)}
                            </p>
                        </motion.li>
                    ))}
                </motion.ol>
            </div>
        </section>
    );
};

/* ------------------------------------------------------------------ */
/* Live booking teaser — the real BookingWidget. Mounting it here fires */
/* the backend /health warmup on landing visit, so Render cold starts   */
/* happen while the visitor reads the hero instead of mid-booking.      */
/* ------------------------------------------------------------------ */

const AvailabilityTeaser = () => {
    const { t } = useTranslation();
    const { status, progress } = useBackendWake();
    const blocked = status !== 'ready';

    return (
        <section className="relative overflow-hidden bg-slate-950 py-20 text-white sm:py-24">
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                <div className="absolute -bottom-40 left-1/4 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
            </div>

            <motion.div
                variants={stagger}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-80px' }}
                className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6"
            >
                <motion.div variants={fadeUp} className="text-center">
                    <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
                        {t('landing.teaser.title')}
                    </h2>
                    <p className="mt-3 text-slate-400">{t('landing.teaser.subtitle')}</p>
                </motion.div>

                <motion.div variants={fadeUp} className="mt-10 flex flex-col items-center gap-4">
                    <div className="relative w-full max-w-md">
                        <div className={cn(blocked && "pointer-events-none select-none grayscale-[0.4] opacity-70")}>
                            <BookingWidget slug={DEFAULT_TENANT_SLUG} />
                        </div>
                        <AnimatePresence>
                            {blocked && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="absolute inset-0 z-10 flex items-start justify-center pt-16"
                                >
                                    <div className="absolute inset-0 rounded-3xl bg-slate-950/60 backdrop-blur-[2px]" aria-hidden="true" />
                                    <div className="relative flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/90 px-5 py-3 shadow-2xl">
                                        <div className="h-8 w-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-400 animate-spin" aria-hidden="true" />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-white">
                                                {status === 'degraded' ? t('server.unreachable') : t('landing.teaser.warming')}
                                            </span>
                                            {status !== 'degraded' && (
                                                <span className="text-[11px] font-bold text-indigo-300 tabular-nums">
                                                    {t('server.warming').replace('{n}', String(progress))}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </motion.div>
        </section>
    );
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
    const { t } = useTranslation();

    return (
        <div className="min-h-screen bg-white antialiased">
            <Hero />
            <Features />
            <HowItWorks />
            <AvailabilityTeaser />

            <footer className="border-t border-slate-200 bg-white py-8">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6">
                    <span className="text-sm font-black tracking-tight text-slate-900">
                        Faci<span className="text-indigo-500">-</span>Table
                    </span>
                    <p className="text-xs text-slate-400">
                        © {new Date().getFullYear()} Faci-Table — {t('landing.footer.rights')}
                    </p>
                </div>
            </footer>
        </div>
    );
}



