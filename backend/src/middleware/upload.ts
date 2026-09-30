import multer from 'multer';
import path from 'path';
import fs from 'fs';

import { isCloudinaryEnabled } from '../lib/cloudinary';

export const FLOOR_PLAN_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'floor-plans');
export const MAX_FLOOR_PLAN_BYTES = 5 * 1024 * 1024;

export const EXT_BY_MIME: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
};

// Disk fallback is dev-only; Cloudinary path uses memory storage (no local file).
if (!isCloudinaryEnabled()) {
    fs.mkdirSync(FLOOR_PLAN_UPLOAD_DIR, { recursive: true });
}

const diskStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, FLOOR_PLAN_UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const ext = EXT_BY_MIME[file.mimetype] ?? path.extname(file.originalname).substring(0, 5);
        cb(null, `floor-plan-${Date.now()}${ext}`);
    },
});

const memoryStorage = multer.memoryStorage();

/**
 * Seating-chart image upload.
 * - Production (CLOUDINARY_URL set): memory storage → streamed to Cloudinary,
 *   DB stores the absolute CDN URL. No ephemeral-disk loss, no CORP issue.
 * - Local dev (no Cloudinary vars): disk storage served via
 *   express.static('public') as /uploads/floor-plans/*.
 */
export const floorPlanUpload = multer({
    storage: isCloudinaryEnabled() ? memoryStorage : diskStorage,
    limits: { fileSize: MAX_FLOOR_PLAN_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
        if (EXT_BY_MIME[file.mimetype]) return cb(null, true);
        cb(new Error('Only JPEG, PNG or WebP images are allowed'));
    },
});
