import { useState, useEffect, useCallback } from 'react';
import { Theme } from '../types';

const THEME_STORAGE_KEY = 'fusioni-chat-theme';

function resolveDisplayTheme(setting: Theme | undefined): 'light' | 'dark' {
  if (setting === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  if (setting === 'dark' || setting === 'light') {
    return setting;
  }
  return 'light';
}

export const useTheme = (initialTheme?: Theme) => {
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light');
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [programmaticTheme, setProgrammaticTheme] = useState<Theme | null>(null);

  const persistThemeSetting = useCallback((setting: Theme) => {
    try {
      if (setting === 'auto') {
        localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        localStorage.setItem(THEME_STORAGE_KEY, setting);
      }
    } catch (error) {
      console.warn('Failed to persist theme to localStorage:', error);
    }
  }, []);

  const setTheme = useCallback((theme: Theme) => {
    setProgrammaticTheme(theme);
    setCurrentTheme(resolveDisplayTheme(theme));
    setIsManualOverride(true);
    persistThemeSetting(theme);
  }, [persistThemeSetting]);

  // Load theme from localStorage on initialization (unless SDK / caller already set a theme)
  useEffect(() => {
    if (programmaticTheme != null) {
      return;
    }
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setCurrentTheme(savedTheme);
        setIsManualOverride(true);
      }
    } catch (error) {
      console.warn('Failed to load theme from localStorage:', error);
    }
  }, [programmaticTheme]);

  const toggleTheme = useCallback(() => {
    setCurrentTheme((prev) => {
      const next: 'light' | 'dark' = prev === 'light' ? 'dark' : 'light';
      setProgrammaticTheme(next);
      setIsManualOverride(true);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch (error) {
        console.warn('Failed to save theme to localStorage:', error);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (programmaticTheme != null) {
      if (programmaticTheme === 'auto') {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
          setCurrentTheme(resolveDisplayTheme('auto'));
        };
        handleChange();
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      }
      return;
    }

    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return;
    }

    if (isManualOverride) {
      return;
    }

    const updateTheme = () => {
      setCurrentTheme(resolveDisplayTheme(initialTheme));
    };

    updateTheme();

    if (initialTheme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => updateTheme();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [initialTheme, isManualOverride, programmaticTheme]);

  return {
    theme: currentTheme,
    toggleTheme,
    setTheme,
    isManualOverride,
  };
};

// Utility function to clear saved theme (useful for debugging or reset)
export const clearSavedTheme = () => {
  try {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear theme from localStorage:', error);
  }
};
