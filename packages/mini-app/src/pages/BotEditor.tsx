import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Rocket, MessageSquare, Layout, Type as TypeIcon } from 'lucide-react';
import { BrickEditor } from '../components/BrickEditor';
import { BrickConnectionLines } from '../components/BrickConnectionLines';
import { MiniSimulator } from '../components/MiniSimulator';
import { Button } from '../components/ui/Button';
import type { Brick, BrickType, MenuOption, BotProject } from '../types';
import { useProjects } from '../contexts/ProjectsContext';
import { useLanguage } from '../hooks/useLanguage';
import { useTheme } from '../hooks/useTheme';
import { useProjectSync } from '../hooks/useProjectSync';
import { generateBrickId, reorderBricks } from '../utils/brick-helpers';
import { ApiConflictError, api } from '../utils/api';
import { projectToSchema, schemaToProject } from '../utils/brick-adapters';
import { validateBricks } from '../utils/brick-validation';
import { formatRelativeTime } from '../utils/debounce';

const WebApp = window.Telegram?.WebApp;

async function showConflictDialog({
  title,
  message,
  options,
}: {
  title: string;
  message: string;
  options: Array<{ label: string; value: 'server' | 'local' }>;
}): Promise<'server' | 'local'> {
  if ((WebApp as any)?.showPopup) {
    return new Promise((resolve) => {
      (WebApp as any).showPopup(
        {
          title,
          message,
          buttons: [
            { id: options[0].value, type: 'default', text: options[0].label },
            { id: options[1].value, type: 'cancel', text: options[1].label },
          ],
        },
        (buttonId: string) => resolve(buttonId === options[0].value ? options[0].value : options[1].value)
      );
    });
  }

  const ok = window.confirm(`${title}\n\n${message}\n\nOK: ${options[0].label}\nCancel: ${options[1].label}`);
  return ok ? options[0].value : options[1].value;
}

export default function BotEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects, updateProject, upsertProject, deleteProject } = useProjects();
  const { t } = useLanguage();
  const { theme } = useTheme();

  const [project, setProject] = useState<BotProject | null>(null);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Use sync hook
  const { syncStatus, lastSyncTime, error: syncError, saveNow, conflictVersion, onResolveConflict } = useProjectSync(project, {
    onProjectSynced: ({ previousId, project: synced }) => {
      setProject(synced);
      upsertProject(synced);
      deleteProject(previousId);
    },
  });

  useEffect(() => {
    if (id) {
      loadProject();
    }
  }, [id]);

  // Update local project state and trigger sync
  const updateLocalProject = (updates: Partial<BotProject>) => {
    if (!project) return;
    const updated = { ...project, ...updates, lastModified: Date.now() };
    setProject(updated);
    updateProject(updated); // Update context (localStorage)
  };

  const loadProject = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

      // Try to load from local projects first
      const localProject = projects.find((p) => p.id === id);
      if (localProject) {
        setProject(localProject);
        setLoading(false);
        return;
      }

      // If not found locally, try to load from API
      const data = await api.getBotSchema(id);
      if (data.schema) {
        const convertedProject = schemaToProject(id, data.name || 'Bot', data.schema);
        convertedProject.serverId = id;
        setProject(convertedProject);
        upsertProject(convertedProject);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConflict = async (serverVersion: number) => {
    void serverVersion;
    if (!project) return;
    const choice = await showConflictDialog({
      title: 'Конфликт версий',
      message: 'Схема была изменена на сервере. Что делать?',
      options: [
        { label: 'Загрузить версию с сервера', value: 'server' },
        { label: 'Сохранить мою версию', value: 'local' },
      ],
    });

    if (choice === 'server') {
      await loadProject(); // Reload from server
    } else {
      // Force save local version (requires special API flag)
      await api.updateBotSchema(project.id, projectToSchema(project), { force: true });
    }
  };

  useEffect(() => {
    const resolveBackgroundConflict = async () => {
      if (syncStatus !== 'conflict' || !conflictVersion) return;
      try {
        await handleConflict(conflictVersion);
        onResolveConflict();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Conflict resolution failed';
        setError(msg);
        WebApp?.showAlert(msg);
      }
    };
    resolveBackgroundConflict();
  }, [conflictVersion, onResolveConflict, syncStatus]);

  const handleSave = async () => {
    if (!project) return;

    // Validate before saving
    const validationErrors = validateBricks(project.bricks);
    if (validationErrors.length > 0) {
      const errorMsg = validationErrors.map((e) => t.editor.validation[e.key]).join('\n');
      WebApp?.showAlert(errorMsg);
      return;
    }

    try {
      setError(null);

      await saveNow();

      WebApp?.showAlert(t.editor.save + ' ✓');
    } catch (err) {
      if (err instanceof ApiConflictError) {
        try {
          await handleConflict(err.serverVersion);
          return;
        } catch (conflictErr) {
          const conflictErrorMessage =
            conflictErr instanceof Error ? conflictErr.message : 'Save failed';
          setError(conflictErrorMessage);
          WebApp?.showAlert(conflictErrorMessage);
          return;
        }
      }
      const errorMessage = err instanceof Error ? err.message : 'Save failed';
      setError(errorMessage);
      WebApp?.showAlert(errorMessage);
    }
  };

  const addBrick = (type: BrickType) => {
    if (!project) return;

    const newBrick: Brick = {
      id: generateBrickId(),
      type,
      content: '',
      options: type === 'menu' ? [{ text: t.editor.placeholders.buttonText }] : undefined,
    };

    updateLocalProject({ bricks: [...project.bricks, newBrick] });
  };

  const updateBrick = (brickId: string, updates: Partial<Brick>) => {
    if (!project) return;

    updateLocalProject({
      bricks: project.bricks.map((b) => (b.id === brickId ? { ...b, ...updates } : b)),
    });
  };

  const removeBrick = (brickId: string) => {
    if (!project) return;

    if (window.confirm(t.editor.deleteConfirm)) {
      updateLocalProject({ bricks: project.bricks.filter((b) => b.id !== brickId) });
    }
  };

  const addOption = (brickId: string) => {
    if (!project) return;

    const brick = project.bricks.find((b) => b.id === brickId);
    if (brick && brick.options) {
      updateBrick(brickId, {
        options: [...brick.options, { text: t.editor.placeholders.buttonText }],
      });
    }
  };

  const updateOption = (brickId: string, optIdx: number, updates: Partial<MenuOption>) => {
    if (!project) return;

    const brick = project.bricks.find((b) => b.id === brickId);
    if (brick && brick.options) {
      const nextOptions = brick.options.map((o, i) => (i === optIdx ? { ...o, ...updates } : o));
      updateBrick(brickId, { options: nextOptions });
    }
  };

  const removeOption = (brickId: string, optIdx: number) => {
    if (!project) return;

    const brick = project.bricks.find((b) => b.id === brickId);
    if (brick && brick.options) {
      const nextOptions = [...brick.options];
      nextOptions.splice(optIdx, 1);
      updateBrick(brickId, { options: nextOptions });
    }
  };

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = () => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex === null || !project) return;

    const reordered = reorderBricks(project.bricks, draggedIndex, index);
    updateLocalProject({ bricks: reordered });
    setDraggedIndex(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-slate-500">Project not found</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            {t.editor.backToProjects}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col h-screen overflow-hidden transition-colors duration-300 ${
        theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'
      }`}
    >
      {/* Header */}
      <header
        className={`px-4 sm:px-6 py-4 sm:py-6 flex items-center gap-3 sm:gap-4 border-b transition-colors ${
          theme === 'dark' ? 'bg-slate-950 border-slate-900' : 'bg-white border-slate-100 shadow-sm'
        }`}
      >
        <Button variant="secondary" onClick={() => navigate('/')} icon={<ArrowLeft size={22} />} />
        <div className="flex-1 min-w-0">
          <input
            value={project.name}
            onChange={(e) => updateLocalProject({ name: e.target.value })}
            className={`bg-transparent text-xl font-black outline-none w-full border-b-2 border-transparent focus:border-indigo-500 transition-all ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}
          />
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
          {syncStatus === 'syncing' && (
            <>
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-600" />
              <span>{t.editor.saving}</span>
            </>
          )}
          {syncStatus === 'idle' && lastSyncTime && (
            <>
              <CheckCircle2 size={14} className="text-emerald-500" />
              <span>Сохранено {formatRelativeTime(lastSyncTime)}</span>
            </>
          )}
          {syncStatus === 'conflict' && (
            <>
              <AlertCircle size={14} className="text-rose-500" />
              <span>Конфликт версий</span>
            </>
          )}
          {syncStatus === 'error' && (
            <>
              <AlertCircle size={14} className="text-rose-500" />
              <span>Ошибка синхронизации</span>
            </>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar max-w-[52vw] sm:max-w-none pl-1">
          <Button
            variant={showLivePreview ? 'primary' : 'secondary'}
            onClick={() => setShowLivePreview(!showLivePreview)}
            icon={showLivePreview ? <EyeOff size={22} /> : <Eye size={22} />}
            className="shrink-0"
          />
          <Button
            variant="secondary"
            onClick={handleSave}
            loading={syncStatus === 'syncing'}
            icon={<Rocket size={20} />}
            className="shrink-0"
          >
            {syncStatus === 'syncing' ? t.editor.saving : t.editor.save}
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate(`/bot/${project.id}/publish`)}
            icon={<Rocket size={20} fill="currentColor" />}
            className="shrink-0"
          >
            {t.editor.publish}
          </Button>
        </div>
      </header>

      {/* Error Banner */}
      {(error || syncError) && (
        <div className="bg-rose-50 border-b border-rose-200 px-6 py-3 text-rose-700 text-sm">
          {error || syncError}
        </div>
      )}

      {/* Main Content */}
      <div
        className={`flex-1 flex transition-all duration-500 overflow-hidden ${
          showLivePreview ? 'flex-col lg:flex-row' : 'flex-col'
        }`}
      >
        {/* Editor Panel */}
        <div
          className={`flex-1 overflow-y-auto p-6 space-y-2 pb-56 transition-all ${
            showLivePreview ? 'hidden lg:block lg:w-2/3' : 'w-full'
          }`}
        >
          {/* Toolbar */}
          <div className="flex gap-4 mb-10 overflow-x-auto py-2 no-scrollbar">
            {[
              {
                type: 'message' as BrickType,
                icon: MessageSquare,
                label: t.editor.blockTypes.message,
                color: 'bg-blue-500',
              },
              { type: 'menu' as BrickType, icon: Layout, label: t.editor.blockTypes.menu, color: 'bg-amber-500' },
              {
                type: 'input' as BrickType,
                icon: TypeIcon,
                label: t.editor.blockTypes.input,
                color: 'bg-emerald-500',
              },
            ].map((btn) => (
              <button
                key={btn.type}
                onClick={() => addBrick(btn.type)}
                className={`flex items-center gap-3 px-6 py-4 rounded-3xl border whitespace-nowrap active:scale-95 transition-all ${
                  theme === 'dark'
                    ? 'bg-slate-900 border-slate-800 text-white hover:border-indigo-500'
                    : 'bg-white border-slate-100 text-slate-900 shadow-md'
                }`}
              >
                <div className={`p-2 rounded-xl ${btn.color} text-white shadow-lg`}>
                  <btn.icon size={16} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">{btn.label}</span>
              </button>
            ))}
          </div>

          {/* Bricks List */}
          <div className="relative">
            <BrickConnectionLines bricks={project.bricks} />
            <div className="space-y-4 relative z-10">
              {project.bricks.map((brick, idx) => (
                <BrickEditor
                  key={brick.id}
                  brick={brick}
                  index={idx}
                  allBricks={project.bricks}
                  onUpdate={(updates) => updateBrick(brick.id, updates)}
                  onDelete={() => removeBrick(brick.id)}
                  onAddOption={brick.type === 'menu' ? () => addOption(brick.id) : undefined}
                  onUpdateOption={
                    brick.type === 'menu' ? (optIdx, updates) => updateOption(brick.id, optIdx, updates) : undefined
                  }
                  onRemoveOption={brick.type === 'menu' ? (optIdx) => removeOption(brick.id, optIdx) : undefined}
                  showArrow={idx < project.bricks.length - 1}
                  draggable={true}
                  onDragStart={handleDragStart(idx)}
                  onDragOver={handleDragOver()}
                  onDrop={handleDrop(idx)}
                />
              ))}
            </div>
          </div>

          <div className="pt-8 pb-8">
            <Button
              variant="primary"
              className="w-full justify-center"
              onClick={() => navigate(`/bot/${project.id}/publish`)}
              icon={<Rocket size={20} fill="currentColor" />}
            >
              Запустить бота
            </Button>
          </div>
        </div>

        {/* Preview Panel (будет реализован в следующей фазе) */}
        {showLivePreview && (
          <div className="flex-1 lg:w-1/3 p-4 lg:p-6 bg-slate-900/10 backdrop-blur-sm border-l border-white/5 overflow-hidden flex flex-col min-h-0">
            <div className="flex-1 min-h-0">
              <MiniSimulator project={project} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
