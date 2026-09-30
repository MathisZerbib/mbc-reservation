import rateLimit from 'express-rate-limit';

/** Consistent JSON body for 429s (default handler sends HTML). */
const jsonHandler = (_req: unknown, res: any) => {
    res.status(429).json({ error: 'Too many requests. Please slow down and try again later.' });
};

/** Login: credential stuffing protection. */
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: jsonHandler,
});

/** Registration: trial-farming protection. */
export const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: jsonHandler,
});

/** Verification-email resends: enumeration + mail-bomb protection. */
export const resendLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: jsonHandler,
});

/** Public availability reads: generous, widget polls on date/size change. */
export const availabilityLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: jsonHandler,
});

/** Public booking writes: spam / fake-reservation protection. */
export const bookingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: jsonHandler,
});

/** AI floor-plan analysis: vision calls are slow + billed per call. */
export const aiAnalyzeLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: jsonHandler,
});
