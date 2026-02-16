import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNavigation } from '../components/BottomNavigation';
import { GlobalHeader } from '../components/GlobalHeader';
import { LimitAlert } from '../components/LimitAlert';
import { HomeTab } from '../components/tabs/HomeTab';
import { BotsTab } from '../components/tabs/BotsTab';
import { SettingsTab } from '../components/tabs/SettingsTab';
import { StoreTab } from '../components/tabs/StoreTab';
import { useLanguage } from '../hooks/useLanguage';
import type { BotProject, MainTab } from '../types';

export default function BotList() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [isLimitOpen, setIsLimitOpen] = useState(false);

  const handleProjectClick = (project: BotProject) => {
    navigate(`/bot/${project.id}`);
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomeTab
            onProjectClick={handleProjectClick}
            onLimitReached={() => setIsLimitOpen(true)}
          />
        );
      case 'bots':
        return <BotsTab />;
      case 'store':
        return <StoreTab />;
      case 'settings':
        return <SettingsTab />;
      default:
        return <div className="px-4 pt-6 text-slate-700 dark:text-slate-200">{t.tabs.home}</div>;
    }
  };

  return (
    <div className="min-h-screen">
      <>
        <GlobalHeader />

        <div className="mx-auto max-w-md pb-28">
          <div key={activeTab} className="animate-in fade-in">
            {renderTab()}
          </div>
        </div>

        <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </>

      <LimitAlert
        isOpen={isLimitOpen}
        onClose={() => setIsLimitOpen(false)}
        onUpgrade={() => {
          setIsLimitOpen(false);
          setActiveTab('store');
        }}
      />
    </div>
  );
}
