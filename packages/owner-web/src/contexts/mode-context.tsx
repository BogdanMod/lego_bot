'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export type WorkMode = 'edit' | 'manage';

interface ModeContextValue {
  mode: WorkMode;
  setMode: (mode: WorkMode) => void;
  isModeSelected: boolean;
}

const ModeContext = createContext<ModeContextValue | undefined>(undefined);

const MODE_STORAGE_KEY = 'owner_work_mode';
const DEFAULT_MODE: WorkMode = 'manage';

export function ModeProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setModeState] = useState<WorkMode>(DEFAULT_MODE);
  const [isModeSelected, setIsModeSelected] = useState(false);

  // Initialize mode from URL or localStorage
  useEffect(() => {
    // Safe access to searchParams (only in client)
    const urlMode = typeof window !== 'undefined' && searchParams 
      ? (searchParams.get('mode') as WorkMode | null)
      : null;
    const storedMode = typeof window !== 'undefined' 
      ? (localStorage.getItem(MODE_STORAGE_KEY) as WorkMode | null)
      : null;
    
    const initialMode = urlMode || storedMode || DEFAULT_MODE;
    setModeState(initialMode);
    // Mode is selected if it's in URL or localStorage (not default)
    setIsModeSelected(!!(urlMode || storedMode));
    
    // Sync localStorage (always save, even if default)
    if (typeof window !== 'undefined') {
      localStorage.setItem(MODE_STORAGE_KEY, initialMode);
    }
  }, [searchParams]);

  const setMode = (newMode: WorkMode) => {
    setModeState(newMode);
    setIsModeSelected(true);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(MODE_STORAGE_KEY, newMode);
      
      // Update URL
      const currentPath = window.location.pathname;
      const newUrl = `${currentPath}?mode=${newMode}`;
      router.replace(newUrl);
    }
  };

  return (
    <ModeContext.Provider value={{ mode, setMode, isModeSelected }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useWorkMode() {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error('useWorkMode must be used within ModeProvider');
  }
  return context;
}

