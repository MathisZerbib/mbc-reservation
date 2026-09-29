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
import { WakeProgress } from '../components/WakeProgress';
import { wakeStageKey } from '../lib/wakeStage';
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
/* Header — the only persistent navigation, so the hero can carry a    */
/* single call to action instead of a wall of buttons.                  */
/* ------------------------------------------------------------------ */

const NAV_LINKS: { href: string; key: TranslationKey }[] = [
    { href: '#features', key: 'landing.hero.cta' },
    { href: '#how', key: 'landing.nav.how' },
    { href: '#availability', key: 'landing.nav.availability' },
];

const SiteHeader = () => {
    const { t } = useTranslation();

    return (
        <header className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/70 backdrop-blur-xl">
            <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
                <a
                    href="#top"
                    className="flex items-center gap-2 text-sm font-black tracking-tight text-white"
                >
                    <span className="h-2 w-2 rounded-full bg-indigo-400 shadow-[0_0_12px_2px_rgba(129,140,248,0.7)]" />
                    Faci-Table
                </a>

                <div className="hidden items-center gap-8 md:flex">
                    {NAV_LINKS.map(({ href, key }) => (
                        <a
                            key={href}
                            href={href}
                            className="text-[13px] font-bold text-slate-400 transition-colors hover:text-white"
                        >
                            {t(key)}
                        </a>
                    ))}
                </div>

                <Link
                    to="/login"
                    className="text-[13px] font-bold text-slate-300 transition-colors hover:text-white"
                >
                    {t('landing.hero.login')}
                </Link>
            </nav>
        </header>
    );
};

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

const HERO_STATS: { valueKey: TranslationKey; labelKey: TranslationKey }[] = [
    { valueKey: 'landing.hero.stats.speed.value', labelKey: 'landing.hero.stats.speed.label' },
    { valueKey: 'landing.hero.stats.doubleBooking.value', labelKey: 'landing.hero.stats.doubleBooking.label' },
    { valueKey: 'landing.hero.stats.uptime.value', labelKey: 'landing.hero.stats.uptime.label' },
];

/** Emphasises the product name at the end of the headline. */
const HeroTitle = ({ text }: { text: string }) => {
    const cut = text.lastIndexOf(' ');
    const lead = cut === -1 ? '' : text.slice(0, cut);
    const accent = cut === -1 ? text : text.slice(cut + 1);

    return (
        <>
            {lead}
            {lead ? ' ' : null}
            <span className="bg-gradient-to-r from-indigo-300 via-sky-200 to-emerald-300 bg-clip-text text-transparent">
                {accent}
            </span>
        </>
    );
};

const Hero = () => {
    const { t } = useTranslation();

    return (
        <section
            id="top"
            className="relative flex min-h-[calc(100svh-4rem)] flex-col overflow-hidden bg-slate-950 text-white"
        >
            {/* Decorative background: drifting aurora + dot grid + film grain */}
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                <div className="absolute -top-40 -left-32 h-96 w-96 animate-drift rounded-full bg-indigo-600/30 blur-3xl motion-reduce:animate-none" />
                <div className="absolute top-1/3 -right-40 h-[28rem] w-[28rem] animate-drift rounded-full bg-emerald-500/10 blur-3xl motion-reduce:animate-none [animation-delay:-6s]" />
                <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:28px_28px]" />
                <div className="absolute inset-0 opacity-[0.035] mix-blend-overlay [background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/></svg>')]" />
            </div>

            <motion.div
                variants={stagger}
                initial="hidden"
                animate="visible"
                className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 py-20 text-center sm:px-6"
            >
                <motion.span
                    variants={fadeUp}
                    className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-indigo-300 backdrop-blur"
                >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Restaurant reservations · real-time
                </motion.span>

                <motion.h1
                    variants={fadeUp}
                    className="max-w-4xl text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
                >
                    <HeroTitle text={t('landing.hero.title')} />
                </motion.h1>

                <motion.p
                    variants={fadeUp}
                    className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg"
                >
                    {t('landing.hero.subtitle')}
                </motion.p>

                {/* One primary action, one supporting link. Nothing else. */}
                <motion.div variants={fadeUp} className="mt-10 flex flex-col items-center gap-5">
                    <Button
                        asChild
                        size="lg"
                        className="h-13 rounded-full bg-indigo-500 px-9 text-base font-black text-white shadow-[0_18px_45px_-15px_rgba(99,102,241,0.9)] transition-transform hover:bg-indigo-400 active:scale-[0.98]"
                    >
                        <Link to="/register">{t('landing.hero.trial')}</Link>
                    </Button>
                    <Link
                        to={`/${DEFAULT_TENANT_SLUG}`}
                        className="group text-sm font-bold text-slate-300 underline-offset-8 transition-colors hover:text-white"
                    >
                        <span className="underline decoration-white/20 decoration-1 underline-offset-8 transition-colors group-hover:decoration-white/60">
                            {t('landing.hero.book')}
                        </span>
                        <span className="inline-block transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0">
                            {' '}→
                        </span>
                    </Link>
                </motion.div>

                <motion.dl
                    variants={stagger}
                    className="mt-16 grid w-full max-w-3xl grid-cols-1 gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/5 sm:grid-cols-3"
                >
                    {HERO_STATS.map(({ valueKey, labelKey }) => (
                        <motion.div
                            key={valueKey}
                            variants={fadeUp}
                            className="flex flex-col-reverse items-center gap-1.5 bg-slate-950/40 px-6 py-6 backdrop-blur"
                        >
                            <dt className="text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                {t(labelKey)}
                            </dt>
                            <dd className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                                {t(valueKey)}
                            </dd>
                        </motion.div>
                    ))}
                </motion.dl>
            </motion.div>

            <motion.a
                href="#features"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1, duration: 0.8 }}
                className="relative z-10 mx-auto mb-10 hidden flex-col items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 transition-colors hover:text-white sm:flex"
            >
                {t('landing.hero.scroll')}
                <span className="relative block h-10 w-px overflow-hidden bg-white/15">
                    <span className="absolute inset-x-0 top-0 h-4 animate-scroll-cue bg-gradient-to-b from-transparent via-indigo-300 to-transparent motion-reduce:animate-none" />
                </span>
            </motion.a>
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
        <section id="how" className="bg-white py-20 sm:py-24">
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
        <section id="availability" className="relative overflow-hidden bg-slate-950 py-20 text-white sm:py-24">
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
                                    className="absolute inset-0 z-10 flex items-start justify-center px-6 pt-14"
                                >
                                    <div className="absolute inset-0 rounded-3xl bg-slate-950/70 backdrop-blur-[3px]" aria-hidden="true" />
                                    <div
                                        role="status"
                                        className="relative w-full max-w-xs rounded-2xl border border-white/10 bg-slate-900/90 px-5 py-4 shadow-2xl backdrop-blur"
                                    >
                                        <WakeProgress
                                            progress={progress}
                                            label={t(wakeStageKey(progress, status === 'degraded'))}
                                            percentLabel={t('server.warming').replace('{n}', String(progress))}
                                        />
                                        <p className="mt-3 text-[11px] font-bold leading-relaxed text-slate-400">
                                            {status === 'degraded' ? t('server.unreachable') : t('landing.teaser.warming')}
                                        </p>
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
            <SiteHeader />
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



