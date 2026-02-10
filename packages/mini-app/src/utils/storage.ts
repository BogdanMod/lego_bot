import type { BotProject, Language, SubscriptionType } from '../types';

const PROJECTS_KEY = 'lego-bot-projects';
const SUBSCRIPTION_KEY = 'lego-bot-subscription';
const LANGUAGE_KEY = 'lego-bot-lang';

export function getProjects(): BotProject[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BotProject[]) : [];
  } catch {
    return [];
  }
}

export function saveProjects(projects: BotProject[]): void {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function getSubscription(): SubscriptionType {
  const raw = localStorage.getItem(SUBSCRIPTION_KEY);
  return raw === 'Premium' || raw === 'Free' ? raw : 'Free';
}

export function saveSubscription(type: SubscriptionType): void {
  localStorage.setItem(SUBSCRIPTION_KEY, type);
}

export function getLanguage(): Language {
  const raw = localStorage.getItem(LANGUAGE_KEY);
  return raw === 'RU' || raw === 'EN' ? raw : 'RU';
}

export function saveLanguage(lang: Language): void {
  localStorage.setItem(LANGUAGE_KEY, lang);
}

