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

/** Unique slug, appending -2, -3… on collision. */
export async function uniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    let slug = base;
    for (let i = 2; ; i += 1) {
        const existing = await prisma.tenant.findUnique({ where: { slug } });
        if (!existing) return slug;
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
