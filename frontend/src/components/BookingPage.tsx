import { BookingWidget } from './BookingWidget';

export const BookingPage = () => {
    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-black text-white tracking-tight mb-2">MBC <span className="text-slate-400">Reservation</span></h1>
                    <p className="text-slate-400 font-medium">Réservez votre table en quelques clics</p>
                </div>
                {/* <div className="bg-white/5 backdrop-blur-xl rounded-[2.5rem] p-4 border border-white/10 shadow-2xl"> */}
                    <BookingWidget />
                {/* </div> */}
            </div>
        </div>
    );
};
