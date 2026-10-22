import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { tr, type Key, type Language } from '../i18n/catalog';
import { setUiLocale } from './common';

const LanguageContext = createContext<Language>('en');
/** Client screens render in the contact's language; the page language attribute follows it for assistive technology (WCAG 3.1.1). */
export function LanguageProvider({ language, children }: { language: Language; children: ReactNode }) {
  setUiLocale(language);
  useEffect(() => { document.documentElement.lang = language; return () => { document.documentElement.lang = 'en'; setUiLocale('en'); }; }, [language]);
  return <LanguageContext.Provider value={language}>{children}</LanguageContext.Provider>;
}
export const useLanguage = () => useContext(LanguageContext);
/** The catalog text for the current language. */
export function useT() {
  const language = useLanguage();
  return (key: Key, vars: Record<string, string | number> = {}) => tr(language, key, vars);
}
