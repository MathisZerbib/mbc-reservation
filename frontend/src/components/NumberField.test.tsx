import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { NumberField } from './NumberField';

describe('NumberField', () => {
    it('lets the user backspace to empty without snapping back', async () => {
        const user = userEvent.setup();
        const onCommit = vi.fn();
        render(<NumberField value={2} onCommit={onCommit} min={1} aria-label="size" />);

        const input = screen.getByLabelText('size');
        await user.clear(input);

        expect(input).toHaveValue(null);
        expect(onCommit).not.toHaveBeenCalled();
    });

    it('commits valid numbers while typing and clamps to min/max', async () => {
        const user = userEvent.setup();
        const onCommit = vi.fn();
        render(<NumberField value={2} onCommit={onCommit} min={1} max={60} aria-label="size" />);

        const input = screen.getByLabelText('size');
        await user.clear(input);
        await user.type(input, '12');
        expect(onCommit).toHaveBeenLastCalledWith(12);

        await user.clear(input);
        await user.type(input, '999');
        expect(onCommit).toHaveBeenLastCalledWith(60);
    });

    it('reverts to the last commit when blurred empty', async () => {
        const user = userEvent.setup();
        render(<NumberField value={4} onCommit={vi.fn()} min={1} aria-label="size" />);

        const input = screen.getByLabelText('size');
        await user.clear(input);
        expect(input).toHaveValue(null);
        await user.tab();
        expect(input).toHaveValue(4);
    });
});
