import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
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

// The language now persists, so each case starts from a known state.
beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

const renderLanding = () =>
    render(
        <MemoryRouter>
            <LanguageProvider>
                <LandingPage />
            </LanguageProvider>
        </MemoryRouter>
    );

describe('LandingPage', () => {
    it('renders the hero headline, CTA and feature sections', () => {
        renderLanding();

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
        expect(
            screen.getByRole('heading', { level: 2, name: 'Testez la disponibilité du restaurant demo !' })
        ).toBeInTheDocument();
        expect(screen.getByText('Taille du groupe')).toBeInTheDocument();
    });

    it('keeps a single primary call to action, the rest is navigation', () => {
        const { container } = renderLanding();

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

    it('switches the whole page to English and remembers the choice', async () => {
        const user = userEvent.setup();
        const { unmount } = renderLanding();

        // The landing page was French-only in practice: the switcher existed
        // on the form pages but not here.
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            'Vos réservations, enfin Faci-Table'
        );

        // The languages live behind a dropdown, not on the page.
        expect(screen.queryByRole('menuitemradio')).toBeNull();
        await user.click(screen.getByRole('button', { name: 'Langue' }));
        expect(screen.getAllByRole('menuitemradio').map(item => item.textContent)).toEqual([
            '🇫🇷Français',
            '🇬🇧English',
        ]);
        expect(
            screen.getByRole('menuitemradio', { name: 'Français' })
        ).toHaveAttribute('aria-checked', 'true');

        await user.click(screen.getByRole('menuitemradio', { name: 'English' }));

        // Picking a language dismisses the menu, the way a native select does.
        await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            'Your reservations, finally Faci-Table'
        );
        expect(screen.getByRole('link', { name: /Start free trial/i })).toHaveAttribute(
            'href',
            '/register'
        );
        expect(screen.getByRole('link', { name: /Manager area/i })).toHaveAttribute('href', '/login');
        expect(
            screen.getByRole('heading', { level: 2, name: 'Try the demo restaurant!' })
        ).toBeInTheDocument();
        expect(screen.getByText('Party Size')).toBeInTheDocument();
        expect(screen.queryByText('Testez la disponibilité du restaurant demo !')).toBeNull();

        // A reload must not bounce the visitor back to French.
        unmount();
        renderLanding();
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            'Your reservations, finally Faci-Table'
        );
    });
});
