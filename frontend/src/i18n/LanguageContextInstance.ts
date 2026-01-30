import { createContext } from 'react';
import { TRANSLATIONS, type Lang } from './translations';

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: typeof TRANSLATIONS['en'];
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);