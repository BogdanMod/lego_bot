import { useEffect, useState } from 'react';
import type { Language } from '../types';
import { getLanguage, saveLanguage } from '../utils/storage';
import { translations } from '../utils/translations';

const LANGUAGE_EVENT = 'lego-bot-language-changed';

export function useLanguage() {
  const [language, setLanguage] = useState<Language>('RU');

  useEffect(() => {
    setLanguage(getLanguage());

    const syncFromStorage = () => {
      setLanguage(getLanguage());
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'lego-bot-lang') {
        syncFromStorage();
      }
    };

    const onCustom = () => {
      syncFromStorage();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener(LANGUAGE_EVENT, onCustom as EventListener);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(LANGUAGE_EVENT, onCustom as EventListener);
    };
  }, []);

  const toggleLanguage = () => {
    setLanguage((prev) => {
      const next: Language = prev === 'RU' ? 'EN' : 'RU';
      saveLanguage(next);
      window.dispatchEvent(new Event(LANGUAGE_EVENT));
      return next;
    });
  };

  const t = translations[language];

  return { language, toggleLanguage, t };
}

