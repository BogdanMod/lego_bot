'use client';

import { Badge } from '@/components/ui/badge';
import { i18n } from '@/lib/i18n';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';

export interface Bot {
  botId: string;
  name: string;
  role: string;
}

export function BotSelector({ bots, currentBotId }: { bots: Bot[]; currentBotId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentBot = bots.find((b) => b.botId === currentBotId);
  const filteredBots = search
    ? bots.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()))
    : bots;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (botId: string) => {
    setIsOpen(false);
    setSearch('');
    // Extract current section from pathname
    const match = pathname.match(/\/cabinet\/[^/]+\/(.+)/);
    const section = match ? match[1] : 'overview';
    router.push(`/cabinet/${botId}/${section}`);
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('owner_lastBotId', botId);
    }
  };

  const roleLabel = currentBot ? i18n.roles[currentBot.role as keyof typeof i18n.roles] || currentBot.role : '';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="text-left">
          <div className="text-sm font-medium">{currentBot?.name || i18n.bot.selectBot}</div>
          {currentBot && (
            <div className="text-xs text-muted-foreground">
              {i18n.bot.context}: {currentBot.name}
            </div>
          )}
        </div>
        {currentBot && roleLabel && (
          <Badge variant={currentBot.role === 'owner' ? 'success' : 'default'}>{roleLabel}</Badge>
        )}
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-card border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-border">
            <input
              type="text"
              placeholder={i18n.common.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto">
            {filteredBots.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">{i18n.bot.noBots}</div>
            ) : (
              filteredBots.map((bot) => (
                <button
                  key={bot.botId}
                  onClick={() => handleSelect(bot.botId)}
                  className={`w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                    bot.botId === currentBotId ? 'bg-primary/10' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{bot.name}</div>
                      <div className="text-xs text-muted-foreground">ID: {bot.botId.slice(0, 8)}...</div>
                    </div>
                    <Badge variant={bot.role === 'owner' ? 'success' : 'default'}>
                      {i18n.roles[bot.role as keyof typeof i18n.roles] || bot.role}
                    </Badge>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

