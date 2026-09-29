import { prisma } from '../lib/prisma';

export const TRIAL_DAYS = 14;

/** URL-safe slug from a restaurant name ("Le Petit Café" → "le-petit-cafe"). */
export function slugify(name: string): string {
    const base = name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 40);
    return base || 'restaurant';
}

/** First path segments owned by the app — never usable as a restaurant slug. */
export const RESERVED_SLUGS = new Set([
    'login', 'register', 'signup', 'verify-email', 'book', 'b',
    'app', 'admin', 'onboarding', 'landing', 'api', 'health', 'version',
]);

/** Pure validation for a user-chosen slug. Throws with a 400-safe message. */
export function parseSlug(input: unknown): string {
    const slug = String(input ?? '').trim().toLowerCase().substring(0, 40);
    if (!/^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/.test(slug) || slug.length < 2) {
        throw new Error('Slug must be 2-40 characters: lowercase letters, numbers and hyphens.');
    }
    if (RESERVED_SLUGS.has(slug)) {
        throw new Error(`"${slug}" is reserved. Please choose another address.`);
    }
    return slug;
}

/** Unique slug, appending -2, -3… on collision. Skips reserved words. */
export async function uniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    let slug = base;
    for (let i = 2; ; i += 1) {
        if (!RESERVED_SLUGS.has(slug)) {
            const existing = await prisma.tenant.findUnique({ where: { slug } });
            if (!existing) return slug;
        }
        slug = `${base}-${i}`;
    }
}

export async function findTenantBySlug(slug: string) {
    return prisma.tenant.findUnique({ where: { slug } });
}

/** Pure check, unit-testable. Demo/sandbox tenants just get long trials. */
export function isTrialActive(trialEndsAt: Date, now: Date = new Date()): boolean {
    return trialEndsAt.getTime() > now.getTime();
}

/** Creates a tenant with a fresh trial plus its settings row. */
export async function createTenant(name: string, trialDays: number = TRIAL_DAYS) {
    const slug = await uniqueSlug(name);
    return prisma.tenant.create({
        data: {
            name: name.trim().substring(0, 60),
            slug,
            trialEndsAt: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000),
            settings: { create: {} },
        },
        include: { settings: true },
    });
}
