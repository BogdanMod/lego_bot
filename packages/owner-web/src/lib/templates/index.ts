/**
 * Templates registry
 * Exports all available templates
 */

import { coffeeShopTemplate } from './coffee-shop';
import { beautySalonTemplate } from './beauty-salon';
import { dentalClinicTemplate } from './dental-clinic';
import { autoServiceTemplate } from './auto-service';
import { onlineStoreTemplate } from './online-store';
import { fitnessStudioTemplate } from './fitness-studio';
import { realEstateTemplate } from './real-estate';
import { lawyerTemplate } from './lawyer';
import { psychologistTemplate } from './psychologist';
import { educationTemplate } from './education';
import { tourAgencyTemplate } from './tour-agency';
import { eventManagerTemplate } from './event-manager';
import { hrRecruitmentTemplate } from './hr-recruitment';
import { productSupportTemplate } from './product-support';
import { foodDeliveryTemplate } from './food-delivery';
import type { TemplateDefinition, TemplateAnswers } from './types';

export const templates: TemplateDefinition[] = [
  coffeeShopTemplate,
  beautySalonTemplate,
  dentalClinicTemplate,
  autoServiceTemplate,
  onlineStoreTemplate,
  fitnessStudioTemplate,
  realEstateTemplate,
  lawyerTemplate,
  psychologistTemplate,
  educationTemplate,
  tourAgencyTemplate,
  eventManagerTemplate,
  hrRecruitmentTemplate,
  productSupportTemplate,
  foodDeliveryTemplate,
];

export function getTemplateById(id: string): TemplateDefinition | undefined {
  return templates.find(t => t.manifest.id === id);
}

export function getAllTemplates(): TemplateDefinition[] {
  return templates;
}

export type { TemplateAnswers, TemplateDefinition } from './types';

