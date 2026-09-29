import React, { useState } from 'react';

interface NumberFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
    /** Committed numeric value owned by the parent. */
    value: number;
    /** Called only with valid numbers (empty/invalid drafts never commit). */
    onCommit: (value: number) => void;
    min?: number;
    max?: number;
    step?: number | string;
}

/**
 * Number input that never fights the user: the draft is a string, so
 * backspacing to empty (desktop or phone keyboards) stays empty while
 * typing. A value commits only when it parses to a finite number, clamped
 * to [min, max]; blurring an invalid draft reverts to the last commit.
 */
export const NumberField: React.FC<NumberFieldProps> = ({
    value,
    onCommit,
    min,
    max,
    step = 1,
    ...rest
}) => {
    const [draft, setDraft] = useState(String(value));
    const [lastCommitted, setLastCommitted] = useState(value);

    // Follow external commits (quick-size buttons, reset) without
    // touching in-progress typing: only resyncs when the parent value
    // actually changed. Render-phase adjustment (React-endorsed pattern).
    if (value !== lastCommitted) {
        setLastCommitted(value);
        setDraft(String(value));
    }

    const commit = (raw: string) => {
        if (raw.trim() === '') return;
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) return;
        const clamped = Math.min(max ?? parsed, Math.max(min ?? parsed, parsed));
        onCommit(clamped);
    };

    return (
        <input
            type="number"
            {...rest}
            value={draft}
            min={min}
            max={max}
            step={step}
            onChange={e => {
                setDraft(e.target.value);
                commit(e.target.value);
            }}
            onBlur={e => {
                if (e.target.value.trim() === '' || !Number.isFinite(Number(e.target.value))) {
                    setDraft(String(value));
                }
            }}
        />
    );
};
