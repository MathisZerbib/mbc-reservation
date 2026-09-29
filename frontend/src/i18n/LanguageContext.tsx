import React, { useEffect, useState, type ReactNode } from 'react';
import { TRANSLATIONS, type Lang } from './translations';
import { LanguageContext } from './LanguageContextInstance';

const STORAGE_KEY = 'faci-table:lang';
const DEFAULT_LANG: Lang = 'fr';
const LOCALES = Object.keys(TRANSLATIONS) as string[];

/** Falls back to the default for anything that is not a shipped locale. */
function readStoredLang(): Lang {
    if (typeof window === 'undefined') return DEFAULT_LANG;
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        return stored && LOCALES.includes(stored) ? (stored as Lang) : DEFAULT_LANG;
    } catch {
        return DEFAULT_LANG;
    }
}

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Lang>(readStoredLang);
  const t = TRANSLATIONS[lang as keyof typeof TRANSLATIONS];

  // The public pages are bilingual, so a visitor who picks English must not
  // land back in French on the next page or after a reload.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Private mode / storage disabled: the choice simply lasts this visit.
    }
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
export { LanguageContext };
