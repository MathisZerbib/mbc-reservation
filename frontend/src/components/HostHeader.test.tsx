import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { HostHeader } from './HostHeader';
import { LanguageProvider } from '../i18n/LanguageContext';

vi.mock('../services/socket', () => ({
    useSocketStatus: () => true,
}));

const LocationProbe: React.FC = () => {
    const loc = useLocation();
    return <p data-testid="location">{loc.pathname}</p>;
};

describe('HostHeader logout', () => {
    it('clears the session and routes to login', () => {
        localStorage.setItem('token', 'header.payload.sig');
        render(
            <MemoryRouter initialEntries={['/app/live']}>
                <LanguageProvider>
                    <HostHeader date="2026-10-02" />
                    <Routes>
                        <Route path="*" element={<LocationProbe />} />
                    </Routes>
                </LanguageProvider>
            </MemoryRouter>,
        );
        fireEvent.click(screen.getByRole('button', { name: /Log out|Se déconnecter/ }));
        expect(localStorage.getItem('token')).toBeNull();
        expect(screen.getByTestId('location').textContent).toBe('/login');
    });
});
