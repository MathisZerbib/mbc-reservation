import multer from 'multer';
import path from 'path';
import fs from 'fs';

export const FLOOR_PLAN_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'floor-plans');
export const MAX_FLOOR_PLAN_BYTES = 5 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
};

fs.mkdirSync(FLOOR_PLAN_UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, FLOOR_PLAN_UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const ext = EXT_BY_MIME[file.mimetype] ?? path.extname(file.originalname).substring(0, 5);
        cb(null, `floor-plan-${Date.now()}${ext}`);
    },
});

/**
 * Local-disk storage for the seating-chart image (tenant choice).
 * NOTE: Render's filesystem is ephemeral — uploads are lost on redeploy.
 * Served via the existing express.static('public') as /uploads/floor-plans/*.
 */
export const floorPlanUpload = multer({
    storage,
    limits: { fileSize: MAX_FLOOR_PLAN_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
        if (EXT_BY_MIME[file.mimetype]) return cb(null, true);
        cb(new Error('Only JPEG, PNG or WebP images are allowed'));
    },
});
