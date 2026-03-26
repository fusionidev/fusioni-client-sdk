import { useState, useEffect } from 'react';
import { Theme } from '../types';

const THEME_STORAGE_KEY = 'fusioni-chat-theme';

export const useTheme = (initialTheme?: Theme) => {
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light');
  const [isManualOverride, setIsManualOverride] = useState(false);

  // Load theme from localStorage on initialization
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setCurrentTheme(savedTheme);
        setIsManualOverride(true);
        return;
      }
    } catch (error) {
      console.warn('Failed to load theme from localStorage:', error);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setCurrentTheme(newTheme);
    setIsManualOverride(true);
    
    // Save to localStorage
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error);
    }
  };

  useEffect(() => {
    // Check if we have a saved theme first
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return; // Don't override saved theme
    }

    if (isManualOverride) return; // Don't auto-update if user manually changed theme

    const updateTheme = () => {
      if (initialTheme === 'auto') {
        // Check system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setCurrentTheme(prefersDark ? 'dark' : 'light');
      } else if (initialTheme === 'dark' || initialTheme === 'light') {
        setCurrentTheme(initialTheme);
      } else {
        // Default to light theme
        setCurrentTheme('light');
      }
    };

    updateTheme();

    if (initialTheme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => updateTheme();
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [initialTheme, isManualOverride]);

  return { 
    theme: currentTheme, 
    toggleTheme,
    isManualOverride 
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
