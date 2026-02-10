import { CheckCircle2, Crown, Zap } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { BRICK_LIMITS } from '../../constants/brick-config';
import { useProjects } from '../../contexts/ProjectsContext';
import { useLanguage } from '../../hooks/useLanguage';

export function StoreTab() {
  const { subscription, setSubscription } = useProjects();
  const { t } = useLanguage();

  const free = BRICK_LIMITS.Free;
  const premium = BRICK_LIMITS.Premium;

  return (
    <div className="px-4 pt-6">
      <div className="text-2xl font-semibold text-slate-900 dark:text-white">{t.store.title}</div>

      <div className="mt-6 flex flex-col gap-4">
        <Card className="relative overflow-hidden" gradient="from-amber-500/20 to-yellow-500/20">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Zap size={20} />
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-900 dark:text-white">{t.store.free.name}</div>
                <div className="text-sm text-slate-600 dark:text-slate-300">{t.store.free.price}</div>
              </div>
            </div>
            {subscription === 'Free' ? <Badge variant="info">{t.store.active}</Badge> : null}
          </div>

          <div className="mt-5 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span>
                {t.store.features.projects}: {free.bots}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span>
                {t.store.features.bricks}: {free.bricksPerBot}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span>
                {t.store.features.support}: {t.store.support.basic}
              </span>
            </div>
            {t.store.freeFeatures.map((feature) => (
              <div key={feature} className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <Button
              className="w-full"
              variant={subscription === 'Free' ? 'secondary' : 'primary'}
              onClick={() => setSubscription('Free')}
              disabled={subscription === 'Free'}
            >
              {subscription === 'Free' ? t.store.active : t.store.choose}
            </Button>
          </div>
        </Card>

        <Card className="relative overflow-hidden" gradient="from-indigo-500/20 to-purple-600/20">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                <Crown size={20} />
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-900 dark:text-white">{t.store.premium.name}</div>
                <div className="text-sm text-slate-600 dark:text-slate-300">{t.store.premium.price}</div>
              </div>
            </div>
            {subscription === 'Premium' ? <Badge variant="info">{t.store.active}</Badge> : null}
          </div>

          <div className="mt-5 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span>
                {t.store.features.projects}: {premium.bots}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span>
                {t.store.features.bricks}: {premium.bricksPerBot}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span>
                {t.store.features.support}: {t.store.support.premium}
              </span>
            </div>
            {t.store.premiumFeatures.map((feature) => (
              <div key={feature} className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <Button
              className="w-full"
              variant={subscription === 'Premium' ? 'secondary' : 'primary'}
              onClick={() => setSubscription('Premium')}
              disabled={subscription === 'Premium'}
            >
              {subscription === 'Premium' ? t.store.active : t.store.choose}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
