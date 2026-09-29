import React, { useState } from 'react';
import clsx from 'clsx';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { LANGUAGES } from '../i18n/translations';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

/**
 * Language dropdown for public pages. The list lives in the i18n module so
 * adding a locale is a one-line change that also shows up in the menu.
 */
export const LangToggle: React.FC<{ className?: string }> = ({ className }) => {
    const { lang, setLang, t } = useTranslation();
    const [open, setOpen] = useState(false);
    const current = LANGUAGES.find(l => l.code === lang) ?? LANGUAGES[0];

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={t('language_label')}
                    className={clsx(
                        'flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-black uppercase tracking-wider text-slate-600 transition-colors hover:text-slate-900',
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
                sideOffset={8}
                className="w-44 rounded-xl border border-slate-200 bg-white p-1.5 text-slate-900 shadow-lg"
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
                                    'flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm font-bold transition-colors',
                                    active
                                        ? 'bg-slate-100 text-slate-900'
                                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                )}
                            >
                                <span aria-hidden="true">{flag}</span>
                                {label}
                                {active && (
                                    <Check
                                        className="ml-auto h-3.5 w-3.5 text-indigo-600"
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
