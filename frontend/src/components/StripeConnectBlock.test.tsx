import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StripeConnectBlock } from './StripeConnectBlock';
import { api } from '../services/api';
import { LanguageProvider } from '../i18n/LanguageContext';

vi.mock('../services/api', () => ({
    api: {
        stripeStatus: vi.fn(),
        stripeConnect: vi.fn(),
    },
}));

const stripeStatus = api.stripeStatus as unknown as ReturnType<typeof vi.fn>;
const stripeConnect = api.stripeConnect as unknown as ReturnType<typeof vi.fn>;

const renderBlock = () => {
    render(
        <LanguageProvider>
            <StripeConnectBlock refresh={vi.fn()} flash={vi.fn()} />
        </LanguageProvider>
    );
};

describe('StripeConnectBlock', () => {
    beforeEach(() => vi.clearAllMocks());

    it('shows the connected state when onboarded', async () => {
        stripeStatus.mockResolvedValue({ configured: true, mode: 'test', accountId: 'acct_1', onboarded: true });
        renderBlock();
        await waitFor(() => expect(screen.getByText(/connected|connecté/i)).toBeInTheDocument());
        expect(stripeConnect).not.toHaveBeenCalled();
    });

    it('starts onboarding on click when not connected', async () => {
        stripeStatus.mockResolvedValue({ configured: true, mode: 'test', accountId: null, onboarded: false });
        stripeConnect.mockResolvedValue({ url: 'https://stripe.test/onboard', accountId: 'acct_1' });
        renderBlock();
        const btn = await waitFor(() => screen.getByRole('button', { name: /connect/i }));
        fireEvent.click(btn);
        await waitFor(() => expect(stripeConnect).toHaveBeenCalled());
    });

    it('shows an actionable session message on 401 (incognito) with retry', async () => {
        const err = Object.assign(new Error('Unauthorized'), { status: 401 });
        stripeStatus.mockRejectedValue(err);
        renderBlock();
        await waitFor(() => expect(screen.getByText(/Unauthorized/)).toBeInTheDocument());
        expect(await screen.findByRole('button', { name: /retry|réessayer/i })).toBeInTheDocument();
    });

    it('explains unconfigured backend instead of hiding', async () => {
        stripeStatus.mockResolvedValue({ configured: false, mode: 'unconfigured', accountId: null, onboarded: false });
        renderBlock();
        await waitFor(() => expect(screen.getByText(/not configured|pas configuré/i)).toBeInTheDocument());
    });
});
