import { useLanguage } from './useLanguage';

/**
 * Dot-path translation keys over the existing `LanguageContext`.
 *
 * `t('landing.hero.title')` resolves nested sections, plain keys keep working
 * (`t('book')`). Unknown keys fall back to the key itself so the UI never
 * renders `undefined`.
 */
type DottedKeys<T> = T extends string
    ? never
    : {
          [K in keyof T & string]: T[K] extends string
              ? K
              : `${K}.${DottedKeys<T[K]>}`;
      }[keyof T & string];

export type TranslationKey = DottedKeys<(typeof import('./translations').TRANSLATIONS)['en']>;

const lookup = (obj: unknown, path: string): string | undefined => {
    const value = path
        .split('.')
        .reduce<unknown>((acc, segment) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[segment] : undefined), obj);
    return typeof value === 'string' ? value : undefined;
};

export const useTranslation = () => {
    const { lang, setLang, t: dict } = useLanguage();

    const t = (key: TranslationKey): string => lookup(dict, key) ?? key;

    return { t, lang, setLang };
};