/**
 * Bot templates service
 * Loads templates from mini-app templates directory
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { BotSchema } from '@dialogue-constructor/shared';
import { createLogger } from '@dialogue-constructor/shared';

const logger = createLogger('templates');

export interface BotTemplate {
  id: string;
  name: string;
  description: string;
  category: 'business' | 'education' | 'entertainment' | 'other';
  icon: string;
  schema: BotSchema;
  preview: {
    screenshot?: string;
    features: string[];
  };
}

export interface TemplateMetadata {
  id: string;
  title: string;
  industry: string;
  goal: string;
  shortDescription: string;
  requiredInputs: Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'email' | 'phone' | 'url';
    required: boolean;
    description?: string;
  }>;
  defaultFlows: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
  tags: string[];
}

let templatesCache: BotTemplate[] | null = null;
let templatesMetadataCache: TemplateMetadata[] | null = null;

/**
 * Load all templates from mini-app templates directory
 */
export async function loadTemplates(): Promise<BotTemplate[]> {
  if (templatesCache) {
    return templatesCache;
  }

  try {
    const templatesDir = join(process.cwd(), 'packages', 'mini-app', 'src', 'templates');
    const files = await readdir(templatesDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    const templates: BotTemplate[] = [];

    for (const file of jsonFiles) {
      try {
        const filePath = join(templatesDir, file);
        const content = await readFile(filePath, 'utf-8');
        const template = JSON.parse(content) as BotTemplate;

        // Validate required fields
        if (
          template.id &&
          template.name &&
          template.description &&
          template.category &&
          template.icon &&
          template.schema &&
          template.preview
        ) {
          templates.push(template);
        } else {
          logger.warn({ file }, 'Template missing required fields');
        }
      } catch (error) {
        logger.error({ file, error }, 'Failed to load template');
      }
    }

    templatesCache = templates;
    logger.info({ count: templates.length }, 'Templates loaded');
    return templates;
  } catch (error) {
    logger.error({ error }, 'Failed to load templates directory');
    return [];
  }
}

/**
 * Convert template to metadata format for API
 */
export function templateToMetadata(template: BotTemplate): TemplateMetadata {
  // Extract flows from schema states
  const flows = Object.entries(template.schema.states || {}).map(([id, state]) => ({
    id,
    name: state.message?.substring(0, 50) || id,
    description: state.message?.substring(0, 200),
  }));

  // Map category to industry (Russian)
  const industryMap: Record<string, string> = {
    business: 'Бизнес',
    education: 'Образование',
    entertainment: 'Развлечения',
    other: 'Другое',
  };
  
  const industry = industryMap[template.category] || template.category;

  // Extract required inputs from template (if any)
  // Map common inputs based on template ID
  const requiredInputs: TemplateMetadata['requiredInputs'] = [];
  
  // Common business inputs
  if (['coffee_shop', 'beauty_salon', 'dental_clinic', 'auto_service', 'fitness_studio', 'real_estate', 'lawyer', 'tour_agency', 'event_manager', 'hr_recruitment'].includes(template.id)) {
    requiredInputs.push(
      { key: 'businessName', label: 'Название бизнеса', type: 'text', required: true },
      { key: 'address', label: 'Адрес', type: 'text', required: true },
      { key: 'contactPhone', label: 'Контактный телефон', type: 'phone', required: true },
      { key: 'workingHours', label: 'Часы работы', type: 'text', required: false }
    );
  }
  
  // Template-specific inputs
  if (template.id === 'coffee_shop') {
    requiredInputs.push(
      { key: 'menuUrl', label: 'Ссылка на меню', type: 'url', required: false }
    );
  }
  
  if (template.id === 'beauty_salon') {
    requiredInputs.push(
      { key: 'servicesList', label: 'Список услуг', type: 'text', required: true },
      { key: 'mastersList', label: 'Список мастеров', type: 'text', required: false }
    );
  }
  
  if (template.id === 'dental_clinic') {
    requiredInputs.push(
      { key: 'doctorsList', label: 'Список врачей', type: 'text', required: true },
      { key: 'servicesList', label: 'Список услуг', type: 'text', required: true }
    );
  }
  
  if (template.id === 'auto_service') {
    requiredInputs.push(
      { key: 'servicesList', label: 'Список услуг', type: 'text', required: true }
    );
  }
  
  if (template.id === 'online_store') {
    requiredInputs.push(
      { key: 'categoriesList', label: 'Категории товаров', type: 'text', required: true },
      { key: 'supportEmail', label: 'Email поддержки', type: 'email', required: false }
    );
  }
  
  if (template.id === 'fitness_studio') {
    requiredInputs.push(
      { key: 'scheduleList', label: 'Расписание', type: 'text', required: true },
      { key: 'membershipList', label: 'Абонементы', type: 'text', required: true },
      { key: 'trainersList', label: 'Тренеры', type: 'text', required: false }
    );
  }
  
  if (template.id === 'real_estate') {
    requiredInputs.push(
      { key: 'region', label: 'Регион работы', type: 'text', required: true }
    );
  }
  
  if (template.id === 'lawyer') {
    requiredInputs.push(
      { key: 'servicesList', label: 'Список услуг', type: 'text', required: true }
    );
  }
  
  if (template.id === 'psychologist') {
    requiredInputs.push(
      { key: 'specialistName', label: 'Имя специалиста', type: 'text', required: true },
      { key: 'pricing', label: 'Стоимость', type: 'text', required: true },
      { key: 'schedule', label: 'Расписание', type: 'text', required: true }
    );
  }
  
  if (template.id === 'education') {
    requiredInputs.push(
      { key: 'coursesList', label: 'Список курсов', type: 'text', required: true }
    );
  }
  
  if (template.id === 'tour_agency') {
    requiredInputs.push(
      { key: 'destinations', label: 'Направления', type: 'text', required: true }
    );
  }
  
  if (template.id === 'event_manager') {
    requiredInputs.push(
      { key: 'eventTypesList', label: 'Типы мероприятий', type: 'text', required: true }
    );
  }
  
  if (template.id === 'hr_recruitment') {
    requiredInputs.push(
      { key: 'vacanciesList', label: 'Вакансии', type: 'text', required: true }
    );
  }
  
  if (template.id === 'product_support') {
    requiredInputs.push(
      { key: 'productName', label: 'Название продукта', type: 'text', required: true },
      { key: 'faqList', label: 'Список FAQ', type: 'text', required: true },
      { key: 'supportEmail', label: 'Email поддержки', type: 'email', required: true }
    );
  }

  return {
    id: template.id,
    title: template.name,
    industry,
    goal: template.description,
    shortDescription: template.description.substring(0, 200),
    requiredInputs,
    defaultFlows: flows.slice(0, 10), // Limit to 10 flows
    tags: template.preview.features || [],
  };
}

/**
 * Get all templates as metadata
 */
export async function getTemplatesMetadata(): Promise<TemplateMetadata[]> {
  if (templatesMetadataCache) {
    return templatesMetadataCache;
  }

  const templates = await loadTemplates();
  templatesMetadataCache = templates.map(templateToMetadata);
  return templatesMetadataCache;
}

/**
 * Get template by ID
 */
export async function getTemplateById(id: string): Promise<BotTemplate | null> {
  const templates = await loadTemplates();
  return templates.find((t) => t.id === id) || null;
}

