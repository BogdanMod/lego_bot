import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Smartphone } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useProjects } from '../contexts/ProjectsContext';
import { useLanguage } from '../hooks/useLanguage';
import { api } from '../utils/api';
import { projectToSchema } from '../utils/brick-adapters';
import { CelebrateScreen } from '../components/CelebrateScreen';
import type { BotProject } from '../types';

const WebApp = window.Telegram?.WebApp;

export default function PublishPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects, updateProject, upsertProject, deleteProject } = useProjects();
  const { t } = useLanguage();

  const project = useMemo(() => projects.find((p) => p.id === id) || null, [projects, id]);

  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [showCelebrate, setShowCelebrate] = useState(false);

  const handleBack = () => {
    if (!id) return navigate('/');
    navigate(`/bot/${id}`);
  };

  const handleDeploy = async () => {
    if (!project) return;

    const nextToken = token.trim();
    if (!nextToken) {
      WebApp?.showAlert(t.publish.description);
      return;
    }

    try {
      setDeploying(true);

      // Persist token immediately so it's not dropped on deploy attempts.
      updateProject({ ...project, botToken: nextToken });

      const schema = projectToSchema(project);
      const createdBot = await api.createBot(project.name, schema, nextToken);

      const publishedProject: BotProject = { ...project, id: createdBot.id, status: 'live', botToken: nextToken };
      deleteProject(project.id);
      upsertProject(publishedProject);

      setShowCelebrate(true);
    } catch (err) {
      // Roll back status so Home tab indicator stays accurate if publish fails.
      updateProject({ ...project, status: 'draft', botToken: nextToken });
      const message = err instanceof Error ? err.message : 'Deploy failed';
      WebApp?.showAlert(message);
    } finally {
      setDeploying(false);
    }
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <p className="text-slate-500 dark:text-slate-400">Project not found</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            {t.editor.backToProjects}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="px-6 py-6 flex items-center gap-4 border-b bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-900">
        <Button variant="secondary" onClick={handleBack} icon={<ArrowLeft size={22} />} />
        <div className="flex-1 min-w-0">
          <div className="text-xl font-black text-slate-900 dark:text-white">{t.publish.title}</div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t.publish.subtitle}</div>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 pt-6 pb-10">
        <Card
          className="border-0 overflow-hidden text-white"
          gradient="from-indigo-600 to-purple-600 dark:from-indigo-700 dark:to-purple-700"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-white">
              <Smartphone size={36} />
            </div>
            <div className="flex-1">
              <div className="text-lg font-semibold">{t.publish.subtitle}</div>
              <div className="mt-2 text-sm text-white/90">{t.publish.description}</div>
            </div>
          </div>

          <div className="mt-6">
            <label className="mb-2 block text-sm text-white/90">{t.publish.botToken}</label>
            <div className="relative">
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                type={showToken ? 'text' : 'password'}
                placeholder={t.publish.tokenPlaceholder}
                className={[
                  'w-full px-4 py-3 rounded-2xl border outline-none transition-all',
                  'bg-white/15 border-white/25 text-white placeholder:text-white/60 focus:ring-4 focus:ring-white/20',
                  'pr-12',
                ].join(' ')}
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-white/80 hover:bg-white/10"
                aria-label="Toggle token visibility"
              >
                {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="mt-6">
            <Button
              className="w-full bg-slate-900 text-white hover:bg-slate-800 shadow-xl dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
              onClick={handleDeploy}
              loading={deploying}
              disabled={deploying}
            >
              {deploying ? t.publish.deploying : t.publish.deploy}
            </Button>
          </div>
        </Card>
      </div>

      <CelebrateScreen
        isOpen={showCelebrate}
        onComplete={() => {
          setShowCelebrate(false);
          navigate('/');
        }}
      />
    </div>
  );
}
