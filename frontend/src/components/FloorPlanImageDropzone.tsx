import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImagePlus, Loader2, Trash2, Replace, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import { useTranslation } from '../i18n/useTranslation';
import { MAX_FLOOR_PLAN_MB, validateFloorPlanFile } from '../utils/floorPlanImage';
import { cn } from '../lib/utils';

export const AI_DRAFT_KEY = 'faci-ai-draft';

interface Props {
    previewUrl: string | null;
    onChanged: () => Promise<void> | void;
}

/**
 * Drag-and-drop floor-plan image uploader.
 * Click, drop, or paste — validates type/size client-side, uploads to
 * Cloudinary via the backend, supports replace + delete.
 */
export const FloorPlanImageDropzone: React.FC<Props> = ({ previewUrl, onChanged }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dragCount = useRef(0);

    const errText = (code: string) =>
        code === 'size'
            ? (t('settings.tooLarge') || `Max ${MAX_FLOOR_PLAN_MB}MB`)
            : code === 'type'
                ? (t('settings.invalidType') || 'Only JPEG, PNG or WebP')
                : code;

    const upload = async (file: File | undefined) => {
        if (!file || uploading || analyzing) return;
        const invalid = validateFloorPlanFile(file);
        if (invalid) {
            setError(errText(invalid));
            return;
        }
        setError(null);
        setUploading(true);
        try {
            await api.uploadFloorPlanImage(file);
            await onChanged();
        } catch (e) {
            setError(e instanceof Error ? e.message : (t('settings.uploadFailed') || 'Upload failed'));
            setUploading(false);
            return;
        }
        setUploading(false);
        // Image is live as background — now auto-detect tables with AI so the
        // interactive map fits the image. Non-blocking: upload already saved.
        setAnalyzing(true);
        try {
            const draft = await api.analyzeFloorPlanImage(file);
            sessionStorage.setItem(AI_DRAFT_KEY, JSON.stringify({ ...draft, at: Date.now() }));
            navigate('/app/floor-plan?ai=1');
        } catch (e) {
            setError(e instanceof Error ? e.message : (t('settings.aiFailed') || 'AI detection failed — use the manual editor.'));
        } finally {
            setAnalyzing(false);
        }
    };

    const handleDelete = async () => {
        if (uploading) return;
        setUploading(true);
        try {
            await api.deleteFloorPlanImage();
            await onChanged();
        } catch (e) {
            setError(e instanceof Error ? e.message : (t('settings.uploadFailed') || 'Upload failed'));
        } finally {
            setUploading(false);
        }
    };

    return (
        <div>
            {previewUrl && (
                <div className="relative mb-3">
                    <img
                        src={previewUrl}
                        alt={t('settings.imageTitle') || 'Floor plan'}
                        className="w-full max-h-64 object-contain bg-slate-50 rounded-2xl border border-slate-100"
                    />
                    <button
                        onClick={handleDelete}
                        disabled={uploading}
                        title={t('common.delete') || 'Delete'}
                        className="absolute top-2 right-2 p-2 bg-white/90 backdrop-blur border border-red-200 text-red-500 hover:text-red-700 hover:border-red-300 rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            )}
            <div
                role="button"
                tabIndex={0}
                aria-label={t('settings.dropCta') || 'Upload floor plan image'}
                onClick={() => inputRef.current?.click()}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
                onDragEnter={e => { e.preventDefault(); dragCount.current += 1; setDragging(true); }}
                onDragLeave={e => { e.preventDefault(); dragCount.current = Math.max(0, dragCount.current - 1); if (dragCount.current === 0) setDragging(false); }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                    e.preventDefault();
                    dragCount.current = 0;
                    setDragging(false);
                    void upload(e.dataTransfer.files?.[0]);
                }}
                onPaste={e => {
                    const file = Array.from(e.clipboardData?.files ?? []).find(f => f.type.startsWith('image/'));
                    if (file) void upload(file);
                }}
                className={cn(
                    "flex flex-col items-center justify-center border-2 border-dashed rounded-2xl py-8 px-4 cursor-pointer transition-all outline-none focus:ring-2 focus:ring-indigo-500/50",
                    dragging
                        ? "border-indigo-500 bg-indigo-50/60 scale-[1.01] shadow-lg shadow-indigo-500/10"
                        : "border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30",
                    (uploading || analyzing) && "opacity-70 pointer-events-none",
                )}
            >
                {uploading || analyzing ? (
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-2" />
                ) : (
                    <ImagePlus className={cn("w-8 h-8 mb-2 transition-colors", dragging ? "text-indigo-500" : "text-slate-300")} />
                )}
                <span className="text-sm font-bold text-slate-500 text-center">
                    {uploading
                        ? (t('settings.uploading') || 'Uploading…')
                        : analyzing
                            ? (t('settings.analyzing') || 'AI is reading your floor plan…')
                            : dragging
                                ? (t('settings.dropHere') || 'Drop the image here')
                                : previewUrl
                                    ? (t('settings.replace') || 'Replace image')
                                    : (t('onboarding.uploadCta') || t('settings.upload') || 'Upload image')}
                </span>
                <span className="text-[11px] font-medium text-slate-400 mt-1 text-center">
                    {t('settings.dropHint') || 'Drag & drop, paste, or click — JPEG, PNG, WebP · 5MB max'}
                </span>
                {!uploading && !analyzing && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-indigo-500 mt-2">
                        <Sparkles className="w-3.5 h-3.5" /> {t('settings.aiAuto') || 'AI auto-detects tables'}
                    </span>
                )}
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploading}
                    onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }}
                />
            </div>
            {previewUrl && (
                <button
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer disabled:opacity-50"
                >
                    <Replace className="w-3.5 h-3.5" /> {t('settings.replace') || 'Replace image'}
                </button>
            )}
            {error && <p className="text-sm font-bold text-red-500 mt-2">{error}</p>}
        </div>
    );
};
