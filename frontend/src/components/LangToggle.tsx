import React, { useState } from 'react';
import clsx from 'clsx';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { LANGUAGES } from '../i18n/translations';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

/**
 * Language dropdown for public pages. `dark` sits on the slate hero header,
 * `light` on white form pages. The list lives in the i18n module so adding a
 * locale is a one-line change that also shows up in the menu.
 */
export const LangToggle: React.FC<{ className?: string; variant?: 'light' | 'dark' }> = ({
    className,
    variant = 'light',
}) => {
    const { lang, setLang, t } = useTranslation();
    const [open, setOpen] = useState(false);
    const dark = variant === 'dark';
    const current = LANGUAGES.find(l => l.code === lang) ?? LANGUAGES[0];

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={t('language_label')}
                    className={clsx(
                        'flex h-9 items-center gap-2 rounded-full border px-3 text-[11px] font-black uppercase tracking-wider transition-colors',
                        dark
                            ? 'border-white/10 bg-white/5 text-slate-200 backdrop-blur hover:bg-white/10 hover:text-white'
                            : 'border-slate-200 bg-slate-100 text-slate-600 shadow-inner hover:text-slate-900',
                        className
                    )}
                >
                    <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span aria-hidden="true">{current.flag}</span>
                    {current.code}
                    <ChevronDown className="h-3 w-3 opacity-50" aria-hidden="true" />
                </button>
            </PopoverTrigger>

            <PopoverContent
                align="end"
                sideOffset={10}
                className={clsx(
                    'w-44 rounded-2xl p-1.5',
                    dark
                        ? 'border-white/10 bg-slate-900/95 text-white shadow-2xl backdrop-blur-xl'
                        : 'border-slate-200 bg-white text-slate-900 shadow-xl'
                )}
            >
                <div role="menu" aria-label={t('language_label')} className="flex flex-col gap-0.5">
                    {LANGUAGES.map(({ code, label, flag }) => {
                        const active = code === lang;
                        return (
                            <button
                                key={code}
                                type="button"
                                role="menuitemradio"
                                aria-checked={active}
                                onClick={() => {
                                    setLang(code);
                                    // Radix Popover does not dismiss itself on
                                    // select, unlike a native <select>.
                                    setOpen(false);
                                }}
                                className={clsx(
                                    'flex h-9 items-center gap-2.5 rounded-xl px-3 text-sm font-bold transition-colors',
                                    active
                                        ? dark
                                            ? 'bg-white/10 text-white'
                                            : 'bg-slate-100 text-slate-900'
                                        : dark
                                          ? 'text-slate-400 hover:bg-white/5 hover:text-white'
                                          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                )}
                            >
                                <span aria-hidden="true">{flag}</span>
                                {label}
                                {active && (
                                    <Check
                                        className={clsx(
                                            'ml-auto h-3.5 w-3.5',
                                            dark ? 'text-indigo-300' : 'text-indigo-600'
                                        )}
                                        aria-hidden="true"
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
};
