'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ownerLogout } from '@/lib/api';
import { useOwnerAuth } from '@/hooks/use-owner-auth';
import { Bot, BarChart3, CreditCard, LogOut } from 'lucide-react';

export function SimpleSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: authData } = useOwnerAuth();

  const handleLogout = async () => {
    await ownerLogout();
    router.replace('/login');
  };

  const navItems = [
    { key: 'bots', label: 'Боты', href: '/cabinet', icon: <Bot className="w-4 h-4" /> },
  ];

  const isActive = (href: string): boolean => {
    if (href === '/cabinet') {
      return pathname === '/cabinet' || pathname === '/cabinet/bots';
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="border-r border-border bg-card flex flex-col h-screen w-56">
      {/* Header */}
      <div className="p-5 border-b border-border">
        <div className="text-sm font-semibold text-fg">Owner Web</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {authData?.user?.firstName || 'Пользователь'}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <button
                key={item.key}
                onClick={() => router.push(item.href)}
                className={`w-full relative flex items-center gap-2.5 px-2 py-2 text-sm transition-colors rounded-md ${
                  active
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-fg hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r" />
                )}
                {item.icon && (
                  <span className={active ? 'text-primary' : 'text-muted-foreground'}>
                    {item.icon}
                  </span>
                )}
                <span className="flex-1 text-left">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-1">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-fg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Выход
        </button>
      </div>
    </aside>
  );
}

