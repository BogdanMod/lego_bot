import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Cpu } from 'lucide-react';
import { Button, Card } from '../components/ui';
import { useProjects } from '../contexts/ProjectsContext';
import { useLanguage } from '../hooks/useLanguage';
import { useTheme } from '../hooks/useTheme';
import { LEGO_TEMPLATES } from '../data/lego-templates';
import type { BotProject, Language } from '../types';
import type { LegoTemplate } from '../data/lego-templates';

interface TemplateGalleryProps {
  onBack: () => void;
  onLimitReached: () => void;
  onTemplateSelected: (project: BotProject) => void;
}

export default function TemplateGallery({ onBack, onLimitReached, onTemplateSelected }: TemplateGalleryProps) {
  const { createProjectFromTemplate } = useProjects();
  const { language, t } = useLanguage();
  const { theme } = useTheme();

  const [creatingId, setCreatingId] = useState<string | null>(null);

  const templates = useMemo(() => LEGO_TEMPLATES, []);
  const isDark = theme === 'dark';

  const handleTemplateSelect = (template: LegoTemplate) => {
    if (creatingId) return;

    setCreatingId(template.id);
    try {
      const name = template.id === 'blank' ? t.templates.blankProject : template.name[language as Language];
      const created = createProjectFromTemplate(name, template.bricks, template.color);
      if (!created) {
        onLimitReached();
        return;
      }
      onTemplateSelected(created);
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <div className={['slide-in-from-right min-h-screen', isDark ? 'bg-slate-950' : 'bg-slate-50'].join(' ')}>
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 px-6 pt-8 pb-10 rounded-b-[3rem]">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15 active:scale-95 transition-all"
        >
          <ArrowLeft size={16} />
          {t.templates.backToHome}
        </button>

        <div className="mt-6 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-white">
            <Cpu size={22} />
          </div>
          <div>
            <div className="text-2xl font-semibold text-white">{t.templates.title}</div>
            <div className="mt-1 text-sm text-white/80">{t.templates.subtitle}</div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 -mt-8 pb-10">
        <div className="flex flex-col gap-4">
          {templates.map((template) => {
            const displayName = template.id === 'blank' ? t.templates.blankProject : template.name[language as Language];
            const displayDescription =
              template.id === 'blank' ? t.templates.blankDescription : template.description[language as Language];

            return (
              <Card
                key={template.id}
                onClick={() => handleTemplateSelect(template)}
                className="relative overflow-hidden rounded-[3rem] p-8 hover:shadow-2xl"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div
                      className={[
                        'flex h-14 w-14 items-center justify-center rounded-3xl text-white shadow-lg',
                        `bg-gradient-to-br ${template.color}`,
                      ].join(' ')}
                    >
                      {template.icon}
                    </div>

                    <div className="flex-1">
                      <div className="text-base font-semibold text-slate-900 dark:text-white">{displayName}</div>
                      <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{displayDescription}</div>

                      <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                        {template.bricks.length} {t.templates.bricksCount}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<ChevronRight size={16} />}
                      loading={creatingId === template.id}
                      disabled={Boolean(creatingId)}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTemplateSelect(template);
                      }}
                    >
                      {t.templates.useTemplate}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

