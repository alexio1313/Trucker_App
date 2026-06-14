import { useState, useEffect, ReactNode } from 'react';
import { I18nContext, makeT, LangCode } from './useI18n';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>(() => {
    return (localStorage.getItem('app_lang') as LangCode) || 'en';
  });

  const setLang = (l: LangCode) => {
    localStorage.setItem('app_lang', l);
    setLangState(l);
  };

  const t = makeT(lang);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}
