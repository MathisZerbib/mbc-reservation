/** Default restaurant slug for the legacy /book path (redirects to /:slug). */
export const DEFAULT_TENANT_SLUG = import.meta.env.VITE_TENANT_SLUG || 'mbc';

/**
 * First path segments owned by the app — a public booking address
 * (/:slug) must never collide with them. Mirrors the backend
 * RESERVED_SLUGS; the server remains the source of truth.
 */
const RESERVED_PATHS = new Set([
    'login', 'register', 'signup', 'verify-email', 'book', 'b',
    'app', 'admin', 'onboarding', 'landing', 'api', 'health', 'version',
]);

/** Whether a path segment may address a restaurant booking page. */
export function isPublicSlug(slug: string | undefined): slug is string {
    return !!slug && /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/.test(slug) && !RESERVED_PATHS.has(slug);
}
