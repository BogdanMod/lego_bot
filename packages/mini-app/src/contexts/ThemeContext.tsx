import React, { useEffect, useRef, useState } from 'react';

export type Theme = 'light' | 'dark';

export interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const isInitializedRef = useRef(false);

  useEffect(() => {
    const stored = localStorage.getItem('lego-bot-theme');
    let initialTheme: Theme = 'dark';

    if (stored === 'light' || stored === 'dark') {
      initialTheme = stored;
    } else {
      const tgTheme = window.Telegram?.WebApp?.colorScheme;
      initialTheme = tgTheme === 'light' || tgTheme === 'dark' ? tgTheme : 'dark';
    }

    setThemeState(initialTheme);
    applyTheme(initialTheme);
    localStorage.setItem('lego-bot-theme', initialTheme);
    isInitializedRef.current = true;
  }, []);

  useEffect(() => {
    if (!isInitializedRef.current) return;
    applyTheme(theme);
    localStorage.setItem('lego-bot-theme', theme);
  }, [theme]);

  const setTheme = (nextTheme: Theme) => {
    setThemeState(nextTheme);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

