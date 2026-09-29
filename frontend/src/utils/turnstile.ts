/**
 * Cloudflare Turnstile site key (public by design).
 * Override with VITE_TURNSTILE_SITE_KEY for other environments;
 * the committed fallback is the project's managed widget.
 */
export const TURNSTILE_SITE_KEY =
    import.meta.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAAFJCu_xkH8gypxu4';
