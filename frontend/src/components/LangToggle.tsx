import React from 'react';
import clsx from 'clsx';
import { useTranslation } from '../i18n/useTranslation';

/** Compact FR/EN switcher for public pages (landing-adjacent flows). */
export const LangToggle: React.FC<{ className?: string }> = ({ className }) => {
    const { lang, setLang } = useTranslation();
    return (
        <div className={clsx("flex bg-slate-100 p-1 rounded-full border border-slate-200 shadow-inner", className)}>
            <button
                type="button"
                onClick={() => setLang('en')}
                aria-label="English"
                className={clsx(
                    "px-3 h-8 rounded-full text-[10px] font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                    lang === 'en' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
            >
                <span className="text-xs">🇬🇧</span> EN
            </button>
            <button
                type="button"
                onClick={() => setLang('fr')}
                aria-label="Français"
                className={clsx(
                    "px-3 h-8 rounded-full text-[10px] font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                    lang === 'fr' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
            >
                <span className="text-xs">🇫🇷</span> FR
            </button>
        </div>
    );
};
