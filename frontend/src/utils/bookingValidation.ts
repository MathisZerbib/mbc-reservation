import { COUNTRIES } from './countries';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const TIME_SLOTS = [
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
    '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00',
];

export const LANGUAGES = [
    { code: 'fr', flag: '🇫🇷', label: 'Fr' },
    { code: 'en', flag: '🇬🇧', label: 'En' },
    { code: 'it', flag: '🇮🇹', label: 'It' },
];

/** Max field lengths (mirrored from backend) */
export const FIELD_LIMITS = {
    NAME_MAX: 20,
    NAME_MIN: 2,
    EMAIL_MAX: 24,
    PHONE_MAX: 20,
    SIZE_MIN: 1,
    SIZE_MAX: 100,
} as const;

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─────────────────────────────────────────────────────────────────────────────
// Sanitization helpers
// ─────────────────────────────────────────────────────────────────────────────

export function sanitizeName(name: string): string {
    return name.trim().substring(0, FIELD_LIMITS.NAME_MAX);
}

export function sanitizeEmail(email: string): string {
    return email.trim().toLowerCase().substring(0, FIELD_LIMITS.EMAIL_MAX);
}

export function buildPhone(dial: string, local: string): string {
    const full = local ? `${dial}${local.replace(/\s/g, '')}` : '';
    return full.substring(0, FIELD_LIMITS.PHONE_MAX);
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/** Returns an error message string or null when valid */
export function validateBookingFields(fields: {
    name: string;
    email: string;
}): string | null {
    if (sanitizeName(fields.name).length < FIELD_LIMITS.NAME_MIN) {
        return 'Name must be at least 2 characters';
    }
    const email = sanitizeEmail(fields.email);
    if (email && !EMAIL_REGEX.test(email)) {
        return 'Invalid email format';
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phone parsing
// ─────────────────────────────────────────────────────────────────────────────

type Country = typeof COUNTRIES[0];

/** Split a stored phone string (e.g. "+33612345678") into dial-code country + local digits */
export function parsePhone(phone: string | undefined): { country: Country; local: string } {
    const defaultCountry = COUNTRIES[0];
    if (!phone) return { country: defaultCountry, local: '' };

    // Sort by dial-code length descending so "+971" matches before "+9"
    const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
    for (const c of sorted) {
        if (phone.startsWith(c.dial)) {
            return { country: c, local: phone.slice(c.dial.length).trim() };
        }
    }
    return { country: defaultCountry, local: phone };
}
