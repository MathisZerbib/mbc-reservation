import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { WakeProgress } from './WakeProgress';
import { wakeStageKey } from '../lib/wakeStage';

describe('WakeProgress', () => {
    it('reports the estimate to assistive tech and clamps it', () => {
        render(
            <WakeProgress progress={140} label="Réveil du serveur" percentLabel="100 %" />
        );

        const bar = screen.getByRole('progressbar');
        expect(bar).toHaveAttribute('aria-valuenow', '100');
        expect(bar).toHaveAttribute('aria-valuemin', '0');
        expect(bar).toHaveAttribute('aria-valuemax', '100');
        expect(bar).toHaveAttribute('aria-label', 'Réveil du serveur');
        expect(screen.getByText('100 %')).toBeInTheDocument();
    });

    it('never claims completion before the server answers', () => {
        // The hook asymptotes at 90% so a stalled cold start cannot look done.
        render(<WakeProgress progress={90} label="Presque prêt" percentLabel="90 %" />);
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '90');
    });
});

describe('wakeStageKey', () => {
    it('advances the copy as the estimate climbs', () => {
        // The UI only appears once the wait is long, so it never says "connecting".
        expect(wakeStageKey(0, false)).toBe('landing.wake.waking');
        expect(wakeStageKey(45, false)).toBe('landing.wake.waking');
        expect(wakeStageKey(80, false)).toBe('landing.wake.almost');
    });

    it('reports the unreachable message instead of a stage', () => {
        expect(wakeStageKey(45, true)).toBe('server.unreachable');
    });
});
