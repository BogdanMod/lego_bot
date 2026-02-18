import { useEffect } from 'react';

type Shortcuts = {
  onSave?: () => void;
  onSearch?: () => void;
  onEscape?: () => void;
};

export function useKeyboardShortcuts(shortcuts: Shortcuts) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + S = Save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        shortcuts.onSave?.();
        return;
      }

      // Cmd/Ctrl + K = Search (go to state)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        shortcuts.onSearch?.();
        return;
      }

      // Escape = Cancel/Close
      if (e.key === 'Escape') {
        shortcuts.onEscape?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

