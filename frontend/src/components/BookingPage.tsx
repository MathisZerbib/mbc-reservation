import { Navigate, useParams } from 'react-router-dom';
import { BookingWidget } from './BookingWidget';
import { NotFound } from './NotFound';
import { DEFAULT_TENANT_SLUG, isPublicSlug } from '../utils/tenant';
import { useLanguage } from '../i18n/useLanguage';

/** Legacy /book path redirects to the default restaurant page. */
export const BookingPage = () => {
    const { t } = useLanguage();
    const { slug } = useParams<{ slug: string }>();

    if (!slug) return <Navigate to={`/${DEFAULT_TENANT_SLUG}`} replace />;
    if (!isPublicSlug(slug)) return <NotFound />;

    return (
        <div className="min-h-dvh bg-slate-900 flex items-center justify-center p-4">
            <div className="max-w-xl w-full">
                <div className="text-center mb-10 sm:mb-12">
                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2">Faci<span className="text-slate-400">-</span>Table</h1>
                    <p className="text-sm sm:text-base text-slate-400 font-medium">{t.intro}</p>
                </div>
                <BookingWidget slug={slug} />
            </div>
        </div>
    );
};
