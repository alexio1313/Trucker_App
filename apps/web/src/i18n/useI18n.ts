import { createContext, useContext } from 'react';
import { translations, LangCode, LANGUAGES, TKey } from './translations';

export { LANGUAGES };
export type { LangCode };

export const I18nContext = createContext<{
  lang: LangCode;
  setLang: (l: LangCode) => void;
  t: (key: TKey) => string;
}>({
  lang: 'en',
  setLang: () => {},
  t: (k) => translations.en[k] as string,
});

export const useI18n = () => useContext(I18nContext);

export function makeT(lang: LangCode) {
  return (key: TKey): string => {
    const langMap = translations[lang] as Record<string, string>;
    return langMap?.[key] ?? (translations.en[key] as string) ?? key;
  };
}
