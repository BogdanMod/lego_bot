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
  // For now, use common inputs based on category
  const requiredInputs: TemplateMetadata['requiredInputs'] = [];
  
  if (template.category === 'business') {
    requiredInputs.push(
      { key: 'businessName', label: 'Название бизнеса', type: 'text', required: true },
      { key: 'contactPhone', label: 'Контактный телефон', type: 'phone', required: true },
      { key: 'contactEmail', label: 'Email', type: 'email', required: false }
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

