import React from 'react';
import clsx from 'clsx';
import { useTranslation } from '../i18n/useTranslation';

/**
 * Compact FR/EN switcher for public pages (landing-adjacent flows).
 * `dark` sits on the slate hero header, `light` on white form pages.
 */
export const LangToggle: React.FC<{ className?: string; variant?: 'light' | 'dark' }> = ({
    className,
    variant = 'light',
}) => {
    const { lang, setLang, t } = useTranslation();
    const dark = variant === 'dark';

    return (
        <div
            role="group"
            aria-label={t('language_label')}
            className={clsx(
                'flex p-1 rounded-full border shadow-inner',
                dark
                    ? 'bg-white/5 border-white/10 backdrop-blur'
                    : 'bg-slate-100 border-slate-200',
                className
            )}
        >
            {(['en', 'fr'] as const).map(code => (
                <button
                    key={code}
                    type="button"
                    onClick={() => setLang(code)}
                    aria-pressed={lang === code}
                    aria-label={code === 'en' ? 'English' : 'Français'}
                    className={clsx(
                        'px-3 h-8 rounded-full text-[10px] font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer',
                        lang === code
                            ? dark
                                ? 'bg-white/15 text-white shadow-sm'
                                : 'bg-white text-slate-900 shadow-sm'
                            : dark
                              ? 'text-slate-400 hover:text-white'
                              : 'text-slate-400 hover:text-slate-600'
                    )}
                >
                    <span className="text-xs" aria-hidden="true">
                        {code === 'en' ? '🇬🇧' : '🇫🇷'}
                    </span>{' '}
                    {code.toUpperCase()}
                </button>
            ))}
        </div>
    );
};
