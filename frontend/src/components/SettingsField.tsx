import React, { useId } from 'react';
import { cn } from '../lib/utils';

interface SettingsFieldProps {
    /** Visible label, e.g. "Average ticket (€ / guest)". */
    label: string;
    /** Short unit badge, e.g. "€", "min", "months", "guests", "HH:MM". */
    unit?: string;
    /** Plain-words explanation + example, e.g. "One number in euros, e.g. 45." */
    hint?: string;
    /** Extra classes for the input row. */
    className?: string;
    children: (inputId: string) => React.ReactNode;
}

/**
 * Dumb-proof field wrapper for Settings: every input gets a visible label,
 * a unit badge, and a one-line hint with an example. Wires label ↔ input
 * via htmlFor for screen readers.
 */
export const SettingsField: React.FC<SettingsFieldProps> = ({ label, unit, hint, className, children }) => {
    const inputId = useId();
    return (
        <div className={cn('flex flex-col gap-1.5', className)}>
            <div className="flex flex-wrap items-center gap-2">
                <label htmlFor={inputId} className="text-xs font-black text-slate-700 dark:text-slate-200">
                    {label}
                </label>
                {unit && (
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {unit}
                    </span>
                )}
            </div>
            {children(inputId)}
            {hint && (
                <p id={`${inputId}-hint`} className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-snug">
                    {hint}
                </p>
            )}
        </div>
    );
};
