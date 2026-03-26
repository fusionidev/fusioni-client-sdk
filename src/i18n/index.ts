import { en } from './en';
import { el } from './el';

export type Language = 'en' | 'el';

export type TranslationKeys = typeof en;

export const translations = {
  en,
  el
} as const;

export const getTranslation = (language: Language, key: string): string => {
  const keys = key.split('.');
  let value: any = translations[language];
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // Fallback to English if key not found
      value = translations.en;
      for (const fallbackKey of keys) {
        if (value && typeof value === 'object' && fallbackKey in value) {
          value = value[fallbackKey];
        } else {
          return key; // Return the key if not found in fallback
        }
      }
      break;
    }
  }
  
  return typeof value === 'string' ? value : key;
};

export const getAvailableLanguages = (): Array<{ code: Language; name: string }> => {
  return [
    { code: 'en', name: 'English' },
    { code: 'el', name: 'Ελληνικά' }
  ];
};

export const isValidLanguage = (language: string): language is Language => {
  return language === 'en' || language === 'el';
};
