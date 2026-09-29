import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeAll } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../i18n/LanguageContext';
import LandingPage from './LandingPage';

// framer-motion's whileInView relies on IntersectionObserver (absent in jsdom).
beforeAll(() => {
    globalThis.IntersectionObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() { return []; }
    } as unknown as typeof IntersectionObserver;
});

describe('LandingPage', () => {
    it('renders the hero headline, CTA and feature sections', () => {
        render(
            <MemoryRouter>
                <LanguageProvider>
                    <LandingPage />
                </LanguageProvider>
            </MemoryRouter>
        );

        // Hero (default language is French)
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Vos réservations, enfin Faci-Table');
        expect(screen.getByRole('link', { name: /Découvrir Faci-Table/i })).toHaveAttribute('href', '/book');

        // Features + How it works
        expect(screen.getByRole('heading', { level: 2, name: 'Une salle qui respire' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 2, name: 'Opérationnel en 3 étapes' })).toBeInTheDocument();

        // Live availability teaser
        expect(screen.getByRole('heading', { level: 2, name: 'Testez la disponibilité' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Vérifier la disponibilité/i })).toBeEnabled();
    });
});
