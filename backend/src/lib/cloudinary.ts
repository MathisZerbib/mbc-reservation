import { v2 as cloudinary } from 'cloudinary';

/**
 * Cloudinary setup for floor-plan images.
 * Uses CLOUDINARY_URL (cloudinary://key:secret@cloud_name) when present,
 * otherwise the split CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET vars.
 * When neither is set, the app falls back to local-disk storage (dev only —
 * Render's filesystem is ephemeral, so production must set Cloudinary vars).
 */

let configured = false;

function ensureConfigured(): boolean {
    if (configured) return true;
    const url = process.env.CLOUDINARY_URL;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (url) {
        // cloudinary.config() reads CLOUDINARY_URL automatically, but call
        // explicitly so tests with stubbed env still configure.
        cloudinary.config({ secure: true });
        configured = true;
        return true;
    }
    if (cloudName && apiKey && apiSecret) {
        cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
        configured = true;
        return true;
    }
    return false;
}

export function isCloudinaryEnabled(): boolean {
    return Boolean(process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET));
}

export function isCloudinaryUrl(url: string | null): boolean {
    if (!url) return false;
    return url.includes('res.cloudinary.com') || url.includes('cloudinary.com');
}

/** Upload an in-memory image buffer. Returns the CDN secure_url. */
export async function uploadFloorPlanBuffer(buffer: Buffer, mimetype: string): Promise<{ url: string; publicId: string }> {
    if (!ensureConfigured()) throw new Error('Cloudinary is not configured');
    const format = mimetype === 'image/png' ? 'png' : mimetype === 'image/webp' ? 'webp' : 'jpg';
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: 'mbc-reservation/floor-plans',
                resource_type: 'image',
                format,
                // Keep originals reasonable; Cloudinary serves resized variants on demand.
                transformation: [{ width: 2000, height: 2000, crop: 'limit', quality: 'auto' }],
            },
            (error, result) => {
                if (error || !result) return reject(error ?? new Error('Cloudinary upload failed'));
                resolve({ url: result.secure_url, publicId: result.public_id });
            },
        );
        stream.end(buffer);
    });
}

/** Extract the public_id from a Cloudinary delivery URL (best-effort). */
export function publicIdFromUrl(url: string): string | null {
    try {
        // …/upload/v1234/folder/public-id.jpg → folder/public-id
        const marker = '/upload/';
        const idx = url.indexOf(marker);
        if (idx === -1) return null;
        let tail = url.slice(idx + marker.length);
        // Strip version prefix (v1234/) if present.
        tail = tail.replace(/^v\d+\//, '');
        // Strip transformation prefixes (e.g. c_limit,w_2000/…) — keep folder path.
        // Heuristic: drop segments containing '_' or ',' until the folder segment.
        const parts = tail.split('/');
        // Cloudinary folder is known; anchor on it when possible.
        const folderIdx = parts.findIndex((p) => p === 'floor-plans');
        const relevant = folderIdx >= 1 ? parts.slice(folderIdx - 1) : parts;
        const last = relevant[relevant.length - 1].split('.')[0];
        relevant[relevant.length - 1] = last;
        return relevant.join('/') || null;
    } catch {
        return null;
    }
}

/** Best-effort deletion of a previous Cloudinary image. Never throws. */
export async function deleteFloorPlanUrl(url: string | null): Promise<void> {
    if (!isCloudinaryUrl(url)) return;
    try {
        if (!ensureConfigured()) return;
        const publicId = publicIdFromUrl(url!);
        if (!publicId) return;
        await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    } catch {
        // Non-fatal: orphaned CDN assets are harmless.
    }
}
