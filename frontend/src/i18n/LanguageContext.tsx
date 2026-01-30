import React, { useState, type ReactNode } from 'react';
import { TRANSLATIONS, type Lang } from './translations';
import { LanguageContext } from './LanguageContextInstance';

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Lang>('fr');
  const t = TRANSLATIONS[lang as keyof typeof TRANSLATIONS];

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
export { LanguageContext };

