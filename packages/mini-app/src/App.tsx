import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import BotList from './pages/BotList';
import BotEditor from './pages/BotEditor';
import Templates from './pages/Templates';
import Clients from './pages/Clients';
import Integrations from './pages/Integrations';
import Analytics from './pages/Analytics';
import Broadcasts from './pages/Broadcasts';
import PublishPage from './pages/PublishPage';
import AdminPanel from './pages/AdminPanel';
import SubscriptionPage from './pages/SubscriptionPage';
import BotsPage from './pages/BotsPage';
import TelegramOnly from './components/TelegramOnly';
import { LegacyRedirect } from './components/LegacyRedirect';
import { BillingNavigation } from './components/BillingNavigation';
import { api, isTelegramWebApp } from './utils/api';
import { useTheme } from '@/hooks/useTheme';
import { ProjectsProvider } from './contexts/ProjectsContext';
import { MaintenanceScreen } from './components/MaintenanceScreen';
import { isAdminUser } from './constants/admin';
import type { MaintenanceState } from './types';
import { Toaster } from 'sonner';
import './App.css';

// Feature flag: MINIAPP_MODE (billing|legacy)
// Default: billing (new simplified mode)
// Set MINIAPP_MODE=legacy to use old full-featured mode
const MINIAPP_MODE = (import.meta.env.VITE_MINIAPP_MODE || 'billing').toLowerCase() as 'billing' | 'legacy';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready(): void;
        expand(): void;
        close(): void;
        showAlert(message: string): void;
        showConfirm(message: string, callback?: (confirmed: boolean) => void): void;
        initData?: string;
        version?: string;
        platform?: string;
        colorScheme: 'light' | 'dark';
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
          secondary_bg_color?: string;
        };
        initDataUnsafe: {
          user?: {
            id: number;
            first_name?: string;
            last_name?: string;
            username?: string;
            language_code?: string;
          };
        };
      };
    };
  }
}

const WebApp = window.Telegram?.WebApp;

function App() {
  const { theme } = useTheme();
  const [maintenance, setMaintenance] = useState<MaintenanceState | null>(null);
  const [maintenanceChecked, setMaintenanceChecked] = useState(false);

  useEffect(() => {
    try {
      console.log('🔧 App useEffect - initializing Telegram WebApp...');
      
      // Инициализация Telegram WebApp SDK
      if (WebApp) {
        console.log('✅ Telegram WebApp found');
        WebApp.ready();
        console.log('✅ WebApp.ready() called');
        
        WebApp.expand();
        console.log('✅ WebApp.expand() called');
        
        // Настройка темы

        
        console.log('📱 Telegram WebApp initialized:', {
          version: WebApp.version,
          platform: WebApp.platform,
          colorScheme: WebApp.colorScheme,
          user: WebApp.initDataUnsafe?.user,
        });
      } else {
        console.warn('⚠️ Telegram WebApp not found');
      }
    } catch (error) {
      console.error('❌ Error initializing Telegram WebApp:', error);
    }
  }, []);

  // Проверяем, что приложение запущено в Telegram
  const isInTelegram = isTelegramWebApp();
  const isAdmin = isAdminUser();
  console.log('🔍 Is in Telegram:', isInTelegram);
  console.log('🎨 Theme:', theme);

  useEffect(() => {
    if (!isInTelegram) {
      return;
    }
    let mounted = true;
    api
      .getMaintenanceStatus()
      .then((data) => {
        if (mounted) {
          setMaintenance(data);
        }
      })
      .catch(() => {
        if (mounted) {
          setMaintenance(null);
        }
      })
      .finally(() => {
        if (mounted) {
          setMaintenanceChecked(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, [isInTelegram]);
  
  if (!isInTelegram) {
    console.log('📱 Not in Telegram, showing TelegramOnly component');
    return <TelegramOnly />;
  }

  if (maintenanceChecked && maintenance?.enabled && !isAdmin) {
    return <MaintenanceScreen message={maintenance.message} />;
  }

  console.log('✅ Rendering main app, mode:', MINIAPP_MODE);

  // Billing mode: simplified UI with only Subscription and Bots
  if (MINIAPP_MODE === 'billing') {
    return (
      <div className="app">
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{
            duration: 4000,
            style: {
              background: 'var(--bg-panel)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            },
          }}
        />
        <Routes>
          <Route path="/" element={<Navigate to="/subscription" replace />} />
          <Route path="/subscription" element={<SubscriptionPage />} />
          <Route path="/bots" element={<BotsPage />} />
          
          {/* Legacy routes - redirect with banner */}
          <Route path="/bot/:id" element={<LegacyRedirect message="Редактирование ботов доступно в Owner Web" />} />
          <Route path="/bot/:id/editor" element={<LegacyRedirect message="Редактирование ботов доступно в Owner Web" />} />
          <Route path="/bot/:id/publish" element={<LegacyRedirect message="Публикация ботов доступна в Owner Web" />} />
          <Route path="/bot/:id/clients" element={<LegacyRedirect message="Управление клиентами доступно в Owner Web" />} />
          <Route path="/bot/:id/integrations" element={<LegacyRedirect message="Интеграции доступны в Owner Web" />} />
          <Route path="/bot/:id/analytics" element={<LegacyRedirect message="Аналитика доступна в Owner Web" />} />
          <Route path="/bot/:id/broadcasts" element={<LegacyRedirect message="Рассылки доступны в Owner Web" />} />
          <Route path="/templates" element={<LegacyRedirect message="Шаблоны доступны в Owner Web" />} />
          <Route path="/admin" element={<AdminPanel />} /> {/* Keep admin panel */}
          <Route path="*" element={<Navigate to="/subscription" replace />} />
        </Routes>
        <BillingNavigation />
      </div>
    );
  }

  // Legacy mode: full-featured app (backward compatible)
  return (
    <ProjectsProvider>
      <div className="app">
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{
            duration: 4000,
            style: {
              background: 'var(--bg-panel)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            },
          }}
        />
        <Routes>
          <Route path="/" element={<BotList />} />
          <Route path="/bot/:id" element={<BotEditor />} />
          <Route path="/bot/:id/editor" element={<BotEditor />} />
          <Route path="/bot/:id/publish" element={<PublishPage />} />
          <Route path="/bot/:id/clients" element={<Clients />} />
          <Route path="/bot/:id/integrations" element={<Integrations />} />
          <Route path="/bot/:id/analytics" element={<Analytics />} />
          <Route path="/bot/:id/broadcasts" element={<Broadcasts />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </ProjectsProvider>
  );
}

export default App;
