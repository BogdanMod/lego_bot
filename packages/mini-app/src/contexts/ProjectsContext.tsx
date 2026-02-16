import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { BotProject, Brick, SubscriptionType } from '../types';
import { BRICK_LIMITS, PROJECT_THEMES } from '../constants/brick-config';
import { getLanguage, getProjects, getSubscription, saveProjects, saveSubscription } from '../utils/storage';
import { translations } from '../utils/translations';
import { regenerateBrickIds } from '../utils/brick-helpers';
import { api, isTelegramWebApp } from '../utils/api';
import { schemaToProject } from '../utils/brick-adapters';
import { useBotSummary } from '../hooks/use-bot-summary';

export interface ProjectsContextType {
  projects: BotProject[];
  subscription: SubscriptionType;
  createProject: () => BotProject | null;
  createProjectFromTemplate: (name: string, bricks: Brick[], themeColor: string) => BotProject | null;
  updateProject: (project: BotProject) => void;
  upsertProject: (project: BotProject) => void;
  deleteProject: (id: string) => void;
  setSubscription: (type: SubscriptionType) => void;
}

export const ProjectsContext = React.createContext<ProjectsContextType | undefined>(undefined);

function generateId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as Crypto).randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function pickThemeColor() {
  const idx = Math.floor(Math.random() * PROJECT_THEMES.length);
  return PROJECT_THEMES[idx];
}

function mergeProjects(local: BotProject[], apiProjects: BotProject[]): BotProject[] {
  const merged = new Map<string, BotProject>();

  // Add local projects
  for (const proj of local) {
    merged.set(proj.id, proj);
  }

  // Override with API projects (they are source of truth)
  for (const proj of apiProjects) {
    merged.set(proj.id, proj);
  }

  return Array.from(merged.values()).sort((a, b) => b.lastModified - a.lastModified);
}

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<BotProject[]>(() => getProjects());
  const [subscription, setSubscriptionState] = useState<SubscriptionType>(() => getSubscription());
  const { data: summary } = useBotSummary();
  const queryClient = useQueryClient();

  useEffect(() => {
    saveProjects(projects);
  }, [projects]);

  useEffect(() => {
    saveSubscription(subscription);
  }, [subscription]);

  // Initial sync from API
  useEffect(() => {
    const syncFromApi = async () => {
      try {
        const { bots } = await api.getBots();
        const apiProjects: BotProject[] = [];

        // Load bot schemas sequentially with delay to avoid rate limiting (429)
        // Rate limit is typically 60 requests per minute, so we add 1.2s delay between requests
        for (let i = 0; i < bots.length; i++) {
          const bot = bots[i];
          try {
            // Add delay between requests (except for the first one)
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 1200)); // 1.2s delay
            }
            
            const { schema, name } = await api.getBotSchema(bot.id);
            if (schema) {
              const project = schemaToProject(bot.id, name || bot.name, schema);
              project.status = bot.webhook_set ? 'live' : 'draft';
              project.serverId = bot.id;
              apiProjects.push(project);
            }
          } catch (err: any) {
            // Log 429 errors specifically
            if (err?.response?.status === 429 || (err as Error)?.message?.includes('429') || (err as Error)?.message?.includes('Too many requests')) {
              console.warn(`Rate limited while loading bot ${bot.id}, skipping remaining bots. Will retry on next sync.`);
              // Stop loading remaining bots if we hit rate limit
              break;
            }
            console.error(`Failed to load bot ${bot.id}:`, err);
          }
        }

        // Merge with local projects (API has priority)
        const merged = mergeProjects(getProjects(), apiProjects);
        setProjects(merged);
        saveProjects(merged);
        
        // Инвалидируем кеш summary после синхронизации
        queryClient.invalidateQueries({ queryKey: ['bot-summary'] });
      } catch (err) {
        console.error('Initial sync failed:', err);
      }
    };

    if (isTelegramWebApp()) {
      syncFromApi();
    }
  }, [queryClient]);

  const createProject = () => {
    // Используем серверный summary для проверки лимита
    const serverLimit = summary?.limit ?? BRICK_LIMITS[subscription].bots;
    const serverActive = summary?.active ?? 0;
    
    // Проверяем лимит по серверным данным
    if (serverActive >= serverLimit) {
      return null;
    }

    const now = Date.now();
    const t = translations[getLanguage()];
    const project: BotProject = {
      id: generateId(),
      name: t.home.projectNameDefault,
      bricks: [],
      lastModified: now,
      status: 'draft',
      themeColor: pickThemeColor(),
    };

    setProjects((prev) => [project, ...prev]);
    return project;
  };

  const createProjectFromTemplate = (name: string, bricks: Brick[], themeColor: string) => {
    // Используем серверный summary для проверки лимита
    const serverLimit = summary?.limit ?? BRICK_LIMITS[subscription].bots;
    const serverActive = summary?.active ?? 0;
    
    // Проверяем лимит по серверным данным
    if (serverActive >= serverLimit) {
      return null;
    }

    const project: BotProject = {
      id: generateId(),
      name,
      bricks: regenerateBrickIds(bricks),
      lastModified: Date.now(),
      status: 'draft',
      themeColor,
    };

    setProjects((prev) => [project, ...prev]);
    return project;
  };

  const updateProject = (project: BotProject) => {
    setProjects((prev) => prev.map((p) => (p.id === project.id ? project : p)));
  };

  const upsertProject = (project: BotProject) => {
    setProjects((prev) => {
      const idx = prev.findIndex((p) => p.id === project.id);
      if (idx >= 0) {
        return prev.map((p) => (p.id === project.id ? project : p));
      }
      return [project, ...prev];
    });
  };

  const deleteProject = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    // Инвалидируем кеш после удаления
    queryClient.invalidateQueries({ queryKey: ['bot-summary'] });
    queryClient.invalidateQueries({ queryKey: ['bots'] });
  };

  const setSubscription = (type: SubscriptionType) => {
    setSubscriptionState(type);
  };

  const value = useMemo<ProjectsContextType>(
    () => ({
      projects,
      subscription,
      createProject,
      createProjectFromTemplate,
      updateProject,
      upsertProject,
      deleteProject,
      setSubscription,
    }),
    [projects, subscription, summary],
  );

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects() {
  const ctx = React.useContext(ProjectsContext);
  if (!ctx) {
    throw new Error('useProjects must be used within a ProjectsProvider');
  }
  return ctx;
}
