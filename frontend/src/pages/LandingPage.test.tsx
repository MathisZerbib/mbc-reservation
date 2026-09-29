import { render, screen, within } from '@testing-library/react';
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
        expect(screen.getByRole('link', { name: /Essai gratuit/i })).toHaveAttribute('href', '/register');
        expect(screen.getByRole('link', { name: /Découvrir Faci-Table/i })).toHaveAttribute('href', '#features');
        expect(screen.getByRole('link', { name: /Réserver une table/i })).toHaveAttribute('href', '/mbc');
        expect(screen.getByRole('link', { name: /Espace manager/i })).toHaveAttribute('href', '/login');

        // Features + How it works
        expect(screen.getByRole('heading', { level: 2, name: 'Une salle qui respire' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 2, name: 'Opérationnel en 3 étapes' })).toBeInTheDocument();

        // Live booking teaser embeds the real widget
        expect(screen.getByRole('heading', { level: 2, name: 'Testez la disponibilité' })).toBeInTheDocument();
        expect(screen.getByText('Taille du groupe')).toBeInTheDocument();
    });

    it('keeps a single primary call to action, the rest is navigation', () => {
        const { container } = render(
            <MemoryRouter>
                <LanguageProvider>
                    <LandingPage />
                </LanguageProvider>
            </MemoryRouter>
        );

        // The booking widget owns buttons of its own, so the rule is scoped to
        // the hero: one filled CTA plus one supporting link, and no manager
        // link competing with it — that moved to the header.
        const hero = container.querySelector('#top') as HTMLElement;
        const heroHrefs = within(hero)
            .getAllByRole('link')
            .map(link => link.getAttribute('href'));

        expect(within(hero).queryAllByRole('button')).toHaveLength(0);
        expect(heroHrefs).toContain('/register');
        expect(heroHrefs).toContain('/mbc');
        expect(heroHrefs).not.toContain('/login');

        const header = container.querySelector('header') as HTMLElement;
        expect(
            within(header)
                .getAllByRole('link')
                .map(link => link.getAttribute('href'))
        ).toContain('/login');
    });
});
