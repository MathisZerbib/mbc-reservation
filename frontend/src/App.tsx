import { FloorPlan } from './components/FloorPlan';
import { BookingWidget } from './components/BookingWidget';
import { Agenda } from './components/Agenda';
import { Analytics } from './components/Analytics';

function App() {
  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-4rem)]">
        {/* Left Column: Floor Plan + Analytics */}
        <div className="lg:col-span-8 flex flex-col gap-8 h-full">
            <header className="flex-none">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">MBC <span className="text-slate-400">Manager</span></h1>
                <p className="text-slate-500 font-medium">Monday, 26 Jan 2026</p>
            </header>
            
            <div className="flex-none">
                 <Analytics />
            </div>

            <div className="flex-1 min-h-0">
                <FloorPlan />
            </div>
        </div>

        {/* Right Column: Agenda + Preview */}
        <div className="lg:col-span-4 flex flex-col gap-8 h-full">
            <div className="flex-1 min-h-0">
                 <Agenda />
            </div>
            
            <div className="flex-none">
                <div className="bg-slate-200 rounded-3xl p-6 relative">
                    <div className="absolute -top-3 left-6 bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Widget Preview</div>
                    <BookingWidget />
                </div>
            </div>
        </div>
      </div>
    </div>
  )
}

export default App
