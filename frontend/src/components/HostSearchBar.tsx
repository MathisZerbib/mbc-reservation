import React, { useEffect, useRef } from 'react';
import { Search, XCircle } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

interface HostSearchBarProps {
    value: string;
    onChange: (v: string) => void;
    /** Live match count shown as a hint while typing. */
    matchCount?: number;
    /** Fired on Enter — the parent selects when exactly one booking matches. */
    onSubmit?: () => void;
}

/**
 * Host command bar: one big field to find a booking by name, table or
 * phone. `/` focuses it from anywhere (outside text inputs). Typing
 * filters the arrivals list and highlights tables on the map live.
 */
export const HostSearchBar: React.FC<HostSearchBarProps> = ({ value, onChange, matchCount, onSubmit }) => {
    const { t } = useTranslation();
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement | null)?.tagName;
            if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    return (
        <div className="relative group flex-none">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors pointer-events-none" />
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter') onSubmit?.();
                    if (e.key === 'Escape') onChange('');
                }}
                placeholder={t('hostSearch.ph')}
                aria-label={t('hostSearch.ph')}
                className="w-full h-12 bg-white dark:bg-slate-800 border-2 border-slate-200/70 dark:border-slate-700 rounded-2xl pl-12 pr-20 text-sm font-bold text-slate-900 dark:text-white shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-500 placeholder:font-medium"
            />
            {typeof matchCount === 'number' && value.trim() !== '' && (
                <span className="absolute right-12 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 tabular-nums pointer-events-none">
                    {matchCount}
                </span>
            )}
            {value !== '' && (
                <button
                    onClick={() => onChange('')}
                    aria-label="Clear"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-100 rounded-lg text-slate-300 hover:text-slate-500 transition-colors cursor-pointer"
                >
                    <XCircle className="w-4 h-4" />
                </button>
            )}
        </div>
    );
};
