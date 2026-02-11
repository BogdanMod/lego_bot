'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { i18n } from '@/lib/i18n';

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
  category: string;
}

export function useCommandPalette(botId?: string) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const commands: Command[] = botId
    ? [
        { id: 'inbox', label: i18n.nav.inbox, shortcut: 'g i', category: 'Навигация', action: () => { router.push(`/cabinet/${botId}/inbox`); setIsOpen(false); } },
        { id: 'calendar', label: i18n.nav.calendar, shortcut: 'g k', category: 'Навигация', action: () => { router.push(`/cabinet/${botId}/calendar`); setIsOpen(false); } },
        { id: 'orders', label: i18n.nav.orders, shortcut: 'g o', category: 'Навигация', action: () => { router.push(`/cabinet/${botId}/orders`); setIsOpen(false); } },
        { id: 'leads', label: i18n.nav.leads, category: 'Навигация', action: () => { router.push(`/cabinet/${botId}/leads`); setIsOpen(false); } },
        { id: 'customers', label: i18n.nav.customers, shortcut: 'g c', category: 'Навигация', action: () => { router.push(`/cabinet/${botId}/customers`); setIsOpen(false); } },
        { id: 'overview', label: i18n.nav.overview, category: 'Навигация', action: () => { router.push(`/cabinet/${botId}/overview`); setIsOpen(false); } },
        { id: 'team', label: i18n.nav.team, category: 'Навигация', action: () => { router.push(`/cabinet/${botId}/team`); setIsOpen(false); } },
        { id: 'settings', label: i18n.nav.settings, category: 'Навигация', action: () => { router.push(`/cabinet/${botId}/settings`); setIsOpen(false); } },
      ]
    : [];

  const filteredCommands = search
    ? commands.filter((c) => c.label.toLowerCase().includes(search.toLowerCase()))
    : commands;

  return { isOpen, setIsOpen, search, setSearch, commands: filteredCommands };
}

export function CommandPalette({ botId }: { botId?: string }) {
  const { isOpen, setIsOpen, search, setSearch, commands } = useCommandPalette(botId);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="fixed inset-0 bg-black/50" onClick={() => setIsOpen(false)} />
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-lg shadow-xl">
        <div className="p-4 border-b border-border">
          <input
            ref={inputRef}
            type="text"
            placeholder="Поиск команд..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent outline-none text-lg"
          />
        </div>
        <div className="max-h-96 overflow-y-auto">
          {commands.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">Нет результатов</div>
          ) : (
            commands.map((cmd) => (
              <button
                key={cmd.id}
                onClick={cmd.action}
                className="w-full text-left px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="font-medium">{cmd.label}</div>
                  <div className="text-xs text-muted-foreground">{cmd.category}</div>
                </div>
                {cmd.shortcut && (
                  <kbd className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 rounded">
                    {cmd.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

