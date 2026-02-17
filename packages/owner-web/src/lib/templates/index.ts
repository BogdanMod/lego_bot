/**
 * Templates registry
 * Exports all available templates
 */

import { coffeeShopTemplate } from './coffee-shop';
import { beautySalonTemplate } from './beauty-salon';
import type { TemplateDefinition, TemplateAnswers } from './types';

export const templates: TemplateDefinition[] = [
  coffeeShopTemplate,
  beautySalonTemplate,
  // TODO: Add remaining 13 templates (dental_clinic, auto_service, online_store, fitness_studio, real_estate, lawyer, psychologist, education, tour_agency, event_manager, hr_recruitment, product_support, food_delivery)
];

export function getTemplateById(id: string): TemplateDefinition | undefined {
  return templates.find(t => t.manifest.id === id);
}

export function getAllTemplates(): TemplateDefinition[] {
  return templates;
}

export type { TemplateAnswers, TemplateDefinition } from './types';

