import { useState, useCallback, useMemo, useEffect } from 'react';
import { Language, getTranslation, getAvailableLanguages, isValidLanguage } from '../i18n';

export const useTranslation = (defaultLanguage: Language = 'en') => {
  const [currentLanguage, setCurrentLanguage] = useState<Language>(defaultLanguage);
  
  // Update internal language state when defaultLanguage prop changes
  useEffect(() => {
    setCurrentLanguage(defaultLanguage);
  }, [defaultLanguage]);

  const t = useCallback((key: string): string => {
    return getTranslation(currentLanguage, key);
  }, [currentLanguage]);

  const changeLanguage = useCallback((language: Language) => {
    setCurrentLanguage(language);
  }, []);

  const availableLanguages = useMemo(() => getAvailableLanguages(), []);

  const isValidLang = useCallback((lang: string): lang is Language => {
    return isValidLanguage(lang);
  }, []);

  return {
    t,
    currentLanguage,
    changeLanguage,
    availableLanguages,
    isValidLanguage: isValidLang
  };
};
