import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import dayjs, { RESTAURANT_TZ } from '../utils/dayjs';
import { Analytics } from './Analytics';
import { useTranslation } from '../i18n/useTranslation';

/**
 * Chef's view: daily pilotage (bookings, turnover, peak, occupancy,
 * per-hour breakdown). Lives on its own route so the host dashboard
 * stays a pure live-ops surface with maximum room for the map.
 */
export const AnalyticsPage: React.FC = () => {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const date = searchParams.get('date') || dayjs.tz(undefined, RESTAURANT_TZ).format('YYYY-MM-DD');

    return (
        <div className="min-h-screen bg-slate-50 p-3 lg:p-6 overflow-y-auto">
            <div className="max-w-[1200px] mx-auto flex flex-col gap-4 pb-8">
                <header className="flex items-center gap-3">
                    <Link
                        to={`/app/dashboard?date=${date}`}
                        className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all"
                        title={t('analyticsPage.back')}
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight leading-none">
                            {t('analyticsPage.title')}
                        </h1>
                        <p className="text-slate-500 font-bold text-xs lg:text-sm mt-1">
                            {dayjs.tz(date, RESTAURANT_TZ).format('dddd, D MMM YYYY')}
                        </p>
                    </div>
                </header>
                <Analytics date={date} />
            </div>
        </div>
    );
};
