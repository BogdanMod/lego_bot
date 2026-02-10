import { useEffect, useMemo, useState } from 'react';
import type { BotProject } from '../types';
import { api, ApiConflictError, ApiNetworkError, formatApiError } from '../utils/api';
import { debounce } from '../utils/debounce';
import { projectToSchema } from '../utils/brick-adapters';
import { useOnlineStatus } from './useOnlineStatus';

export function useProjectSync(
  project: BotProject | null,
  options?: {
    onProjectSynced?: (args: { previousId: string; project: BotProject }) => void;
  }
) {
  const isOnline = useOnlineStatus();
  const [pendingChanges, setPendingChanges] = useState<BotProject[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'conflict'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflictVersion, setConflictVersion] = useState<number | null>(null);
  const [conflictProjectId, setConflictProjectId] = useState<string | null>(null);

  const ensureSyncedProject = async (proj: BotProject): Promise<BotProject> => {
    if (proj.serverId) return proj;

    const previousId = proj.id;
    const schema = projectToSchema(proj);
    const created = await api.createBot(proj.name, schema);

    const synced: BotProject = {
      ...proj,
      id: created.id,
      serverId: created.id,
    };

    options?.onProjectSynced?.({ previousId, project: synced });
    return synced;
  };

  useEffect(() => {
    if (isOnline && pendingChanges.length > 0) {
      // Sync pending changes when back online
      syncPendingChanges();
    }
  }, [isOnline, pendingChanges]);

  const onResolveConflict = () => {
    setConflictVersion(null);
    setConflictProjectId(null);
    setSyncStatus('idle');
    setError(null);
  };

  const syncPendingChanges = async () => {
    for (const proj of pendingChanges) {
      try {
        setSyncStatus('syncing');
        const synced = await ensureSyncedProject(proj);
        await api.updateBotProject(synced);
        setPendingChanges(prev => prev.filter(p => p.id !== proj.id));
        setLastSyncTime(Date.now());
        setSyncStatus('idle');
        setError(null);
      } catch (err) {
        if (err instanceof ApiConflictError) {
          setPendingChanges(prev => prev.filter(p => p.id !== proj.id));
          setSyncStatus('conflict');
          setConflictVersion(err.serverVersion);
          setConflictProjectId(proj.serverId || proj.id);
          setError(formatApiError(err));
          return;
        }
        console.error('Failed to sync pending change:', err);
        setSyncStatus('error');
        setError(formatApiError(err) || (err instanceof Error ? err.message : String(err)));
      }
    }
  };

  // Debounced auto-save (5 секунд после последнего изменения)
  const debouncedSave = useMemo(
    () => debounce(async (proj: BotProject) => {
      try {
        if (conflictVersion !== null) {
          return;
        }

        if (!isOnline) {
          setPendingChanges(prev => [...prev, proj]);
          setSyncStatus('error');
          setError('Нет подключения');
          return;
        }

        setSyncStatus('syncing');
        const synced = await ensureSyncedProject(proj);
        await api.updateBotProject(synced);
        setLastSyncTime(Date.now());
        setSyncStatus('idle');
        setError(null);
      } catch (err) {
        if (err instanceof ApiConflictError) {
          setSyncStatus('conflict');
          setConflictVersion(err.serverVersion);
          setConflictProjectId(proj.serverId || proj.id);
          setError(formatApiError(err));
          return;
        }
        setSyncStatus('error');
        setError(formatApiError(err) || (err instanceof Error ? err.message : String(err)));

        if (err instanceof ApiNetworkError) {
          setPendingChanges(prev => [...prev, proj]);
        }
      }
    }, 5000),
    [conflictVersion, isOnline]
  );

  // Trigger auto-save on project changes
  useEffect(() => {
    if (project) {
      debouncedSave(project);
    }
  }, [project, debouncedSave]);

  // Manual save function
  const saveNow = async () => {
    if (!project) return;
    debouncedSave.cancel();
    try {
      if (conflictVersion !== null) {
        throw new ApiConflictError(
          'Схема была изменена на сервере. Обновите страницу для получения последней версии.',
          conflictVersion
        );
      }

      if (!isOnline) {
        setPendingChanges(prev => [...prev, project]);
        setSyncStatus('error');
        setError('Нет подключения');
        throw new ApiNetworkError('Нет подключения');
      }

      setSyncStatus('syncing');
      const synced = await ensureSyncedProject(project);
      await api.updateBotProject(synced);
      setLastSyncTime(Date.now());
      setSyncStatus('idle');
      setError(null);
    } catch (err) {
      if (err instanceof ApiConflictError) {
        setSyncStatus('conflict');
        setConflictVersion(err.serverVersion);
        setConflictProjectId(project.serverId || project.id);
        setError(formatApiError(err));
        throw err;
      }
      setSyncStatus('error');
      setError(formatApiError(err) || (err instanceof Error ? err.message : String(err)));
      throw err;
    }
  };

  return { syncStatus, lastSyncTime, error, saveNow, conflictVersion, conflictProjectId, onResolveConflict };
}
