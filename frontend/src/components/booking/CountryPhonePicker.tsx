import React, { useMemo, useState } from 'react';
import { ChevronDown, Phone, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { COUNTRIES } from '../../utils/countries';
import { cn } from '../../lib/utils';

type Country = typeof COUNTRIES[0];

interface CountryPhonePickerProps {
    selectedCountry: Country;
    onCountryChange: (country: Country) => void;
    phoneValue: string;
    onPhoneChange: (value: string) => void;
}

export const CountryPhonePicker: React.FC<CountryPhonePickerProps> = ({
    selectedCountry,
    onCountryChange,
    phoneValue,
    onPhoneChange,
}) => {
    const [countrySearch, setCountrySearch] = useState('');

    const filteredCountries = useMemo(() => {
        const s = countrySearch.toLowerCase().trim();
        if (!s) return COUNTRIES;
        return COUNTRIES.filter(c =>
            c.name.toLowerCase().includes(s) ||
            c.dial.includes(s) ||
            c.code.toLowerCase().includes(s)
        );
    }, [countrySearch]);

    return (
        <div className="relative group flex gap-2">
            <Popover>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        className="flex items-center gap-2 bg-slate-50 border-2 border-slate-100 rounded-2xl px-3 hover:bg-white hover:border-indigo-500/50 transition-all cursor-pointer h-[52px] sm:h-[60px]"
                    >
                        <span className="text-lg">{selectedCountry.flag}</span>
                        <span className="text-xs font-bold text-slate-500">{selectedCountry.dial}</span>
                        <ChevronDown className="w-3 h-3 text-slate-300" />
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    className="w-68 p-0 bg-white border-slate-100 shadow-2xl rounded-2xl z-110 overflow-hidden"
                    align="start"
                >
                    <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                        <div className="relative group/search">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within/search:text-indigo-500 transition-colors" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search country..."
                                value={countrySearch}
                                onChange={e => setCountrySearch(e.target.value)}
                                className="w-full bg-white border-2 border-slate-100 rounded-xl py-2 pl-9 pr-3 text-xs font-bold text-slate-700 focus:border-indigo-500/30 outline-none transition-all"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-1 max-h-60 overflow-y-auto p-2 scrollbar-thin">
                        {filteredCountries.length > 0 ? (
                            filteredCountries.map(c => (
                                <button
                                    key={c.code}
                                    type="button"
                                    onClick={() => {
                                        onCountryChange(c);
                                        setCountrySearch('');
                                    }}
                                    className={cn(
                                        'flex items-center gap-3 w-full p-2.5 rounded-xl text-left transition-all hover:bg-slate-50',
                                        selectedCountry.code === c.code && 'bg-indigo-50/50 text-indigo-700'
                                    )}
                                >
                                    <span className="text-xl">{c.flag}</span>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold">{c.name}</span>
                                        <span className="text-[10px] text-slate-400 font-medium">{c.dial}</span>
                                    </div>
                                </button>
                            ))
                        ) : (
                            <div className="p-8 text-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    No matching country
                                </p>
                            </div>
                        )}
                    </div>
                </PopoverContent>
            </Popover>

            <div className="relative flex-1 group/phone">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/phone:text-indigo-500 transition-colors">
                    <Phone className="w-4 h-4" />
                </div>
                <input
                    type="tel"
                    maxLength={15}
                    placeholder="Phone Number (Optional)"
                    value={phoneValue}
                    onChange={e => onPhoneChange(e.target.value.replace(/[^\d\s]/g, ''))}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 sm:py-4 pl-12 pr-4 font-bold text-slate-900 focus:border-indigo-500/50 focus:bg-white outline-none transition-all"
                />
            </div>
        </div>
    );
};
