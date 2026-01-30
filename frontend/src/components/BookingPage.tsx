import { BookingWidget } from './BookingWidget';
import { useLanguage } from '../i18n/useLanguage';

export const BookingPage = () => {
    const { t } = useLanguage();
    
    return (
        <div className="min-h-dvh bg-slate-900 flex items-center justify-center p-4">
            <div className="max-w-xl w-full">
                <div className="text-center mb-10 sm:mb-12">
                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2">MBC <span className="text-slate-400">Reservation</span></h1>
                    <p className="text-sm sm:text-base text-slate-400 font-medium">{t.intro}</p>
                </div>
                <BookingWidget />
            </div>
        </div>
    );
};
