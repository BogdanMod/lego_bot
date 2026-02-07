import React from 'react';
import { Layers, Plus, Search, Smartphone, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { PROJECT_THEMES } from '../../constants/brick-config';
import type { BotProject } from '../../types';
import { useProjects } from '../../contexts/ProjectsContext';
import { useLanguage } from '../../hooks/useLanguage';

export interface HomeTabProps {
  onProjectClick: (project: BotProject) => void;
  onTemplatesClick: () => void;
  onLimitReached: () => void;
}

export function HomeTab({ onProjectClick, onTemplatesClick, onLimitReached }: HomeTabProps) {
  const { projects, createProject, deleteProject } = useProjects();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  const handleCreate = () => {
    const created = createProject();
    if (!created) {
      onLimitReached();
    }
  };

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center justify-between gap-3">
        <div className="text-2xl font-semibold text-slate-900 dark:text-white">{t.home.title}</div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Layers size={16} />}
            onClick={onTemplatesClick}
          >
            {t.home.templates}
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={16} />}
            onClick={handleCreate}
          >
            {t.home.create}
          </Button>
        </div>
      </div>

      <div className="mt-5">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.home.searchPlaceholder}
          icon={<Search size={18} />}
        />
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {filteredProjects.length === 0 ? (
          <Card>
            <div className="text-base font-semibold text-slate-900 dark:text-white">{t.home.emptyTitle}</div>
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t.home.emptyHint}</div>
          </Card>
        ) : (
          filteredProjects.map((project) => {
            const gradient = project.themeColor || PROJECT_THEMES[0];
            const isLive = project.status === 'live';
            return (
              <Card
                key={project.id}
                gradient={gradient}
                onClick={() => onProjectClick(project)}
                className="relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-white">
                      <Smartphone size={20} />
                    </div>
                    <div>
                      <div className="text-base font-semibold text-white">{project.name}</div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-white/90">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            project.status === 'live'
                              ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                              : 'bg-slate-300'
                          }`}
                        />
                        <span>{isLive ? t.home.live : t.home.draft}</span>
                        <span className="text-white/60">•</span>
                        <span>
                          {project.bricks.length} {t.home.blocks}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteProject(project.id);
                    }}
                    className="rounded-2xl p-2 text-white/90 hover:bg-white/10 active:scale-95 transition-all"
                    aria-label={t.home.delete}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
