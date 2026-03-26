import React, { useState, useRef, useEffect } from 'react';
import { Language } from '../i18n';
import { useTranslation } from '../hooks/useTranslation';

interface LanguageSwitcherProps {
  currentLanguage: Language;
  onLanguageChange: (language: Language) => void;
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  currentLanguage,
  onLanguageChange,
  className = ''
}) => {
  const { t, availableLanguages } = useTranslation(currentLanguage);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLang = availableLanguages.find(lang => lang.code === currentLanguage);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLanguageSelect = (language: Language) => {
    onLanguageChange(language);
    setIsOpen(false);
  };

  return (
    <div className={`fusioni-language-switcher ${className}`} ref={dropdownRef}>
      <button
        className="fusioni-language-button"
        onClick={() => setIsOpen(!isOpen)}
        title={t('language.switchLanguage')}
      >
        <span className="fusioni-language-flag">
          {currentLanguage === 'en' ? '🇺🇸' : '🇬🇷'}
        </span>
        <span className="fusioni-language-name">
          {currentLang?.name}
        </span>
        <svg 
          className={`fusioni-language-arrow ${isOpen ? 'open' : ''}`}
          width="12" 
          height="12" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {isOpen && (
        <div className="fusioni-language-dropdown">
          {availableLanguages.map((language) => (
            <button
              key={language.code}
              className={`fusioni-language-option ${
                language.code === currentLanguage ? 'active' : ''
              }`}
              onClick={() => handleLanguageSelect(language.code)}
            >
              <span className="fusioni-language-flag">
                {language.code === 'en' ? '🇺🇸' : '🇬🇷'}
              </span>
              <span className="fusioni-language-name">
                {language.name}
              </span>
              {language.code === currentLanguage && (
                <svg 
                  className="fusioni-language-check"
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                >
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
