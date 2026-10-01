import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TeamCard } from './TeamCard';
import { api } from '../services/api';
import { LanguageProvider } from '../i18n/LanguageContext';

vi.mock('../services/api', () => ({
    api: {
        getUsers: vi.fn(),
        createUser: vi.fn(),
        deleteUser: vi.fn(),
    },
}));

const getUsers = api.getUsers as unknown as ReturnType<typeof vi.fn>;
const createUser = api.createUser as unknown as ReturnType<typeof vi.fn>;

const renderCard = (flash = vi.fn()) => {
    render(
        <LanguageProvider>
            <TeamCard flash={flash} />
        </LanguageProvider>
    );
    return flash;
};

describe('TeamCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getUsers.mockResolvedValue([
            { id: '1', email: 'owner@r.fr', role: 'OWNER', emailVerified: null, createdAt: '2026-01-01' },
            { id: '2', email: 'staff@r.fr', role: 'STAFF', emailVerified: null, createdAt: '2026-01-02' },
        ]);
    });

    it('lists team members with roles', async () => {
        renderCard();
        await waitFor(() => expect(screen.getByText('owner@r.fr')).toBeInTheDocument());
        expect(screen.getByText('staff@r.fr')).toBeInTheDocument();
    });

    it('rejects invites with a short password without calling the API', async () => {
        const flash = renderCard();
        await waitFor(() => expect(screen.getByText('owner@r.fr')).toBeInTheDocument());
        fireEvent.change(screen.getByPlaceholderText(/teammate|equipier/i), { target: { value: 'new@r.fr' } });
        fireEvent.change(screen.getByPlaceholderText(/Password|Mot de passe/i), { target: { value: 'short' } });
        fireEvent.click(screen.getByRole('button', { name: /Invite|Inviter/i }));
        expect(createUser).not.toHaveBeenCalled();
        expect(flash).toHaveBeenCalledWith('err', expect.any(String));
    });

    it('invites staff with valid input', async () => {
        createUser.mockResolvedValue({ id: '3', email: 'new@r.fr', role: 'STAFF' });
        renderCard();
        await waitFor(() => expect(screen.getByText('owner@r.fr')).toBeInTheDocument());
        fireEvent.change(screen.getByPlaceholderText(/teammate|equipier/i), { target: { value: 'new@r.fr' } });
        fireEvent.change(screen.getByPlaceholderText(/Password|Mot de passe/i), { target: { value: 'longpassword123' } });
        fireEvent.click(screen.getByRole('button', { name: /Invite|Inviter/i }));
        await waitFor(() => expect(createUser).toHaveBeenCalledWith({
            email: 'new@r.fr',
            password: 'longpassword123',
            role: 'STAFF',
        }));
    });
});
