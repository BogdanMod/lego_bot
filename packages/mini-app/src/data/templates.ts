import { BotSchema, UpdateBotSchemaSchema } from '@dialogue-constructor/shared/browser';

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

export type TemplateLoadErrorType = 'parse' | 'validation';

export interface TemplateLoadError {
  file: string;
  type: TemplateLoadErrorType;
  message: string;
  position?: number | null;
}

const getFileName = (filePath: string) => filePath.split('/').pop() ?? filePath;

// Templates are stored as JSON for easy edits; this loader keeps the type-safe boundary.
export async function getTemplates(): Promise<{
  templates: BotTemplate[];
  errors: TemplateLoadError[];
}> {
  const rawModules = import.meta.glob('../templates/*.json', {
    eager: true,
  }) as Record<string, unknown>;
  const modules = Object.fromEntries(
    Object.entries(rawModules).map(([path, mod]) => [
      path,
      // Vite typically exposes parsed JSON as the module's default export.
      // Keep it resilient across Vite versions/build modes.
      (mod as any)?.default ?? mod,
    ])
  ) as Record<string, BotTemplate>;
  const templates: BotTemplate[] = [];
  const errors: TemplateLoadError[] = [];

  for (const [path, template] of Object.entries(modules)) {
    const fileName = getFileName(path);
    const data = template as unknown as BotTemplate;
    const issues: string[] = [];

    if (!data || typeof data !== 'object') {
      issues.push('Template data is not an object');
    }
    if (!data?.id || typeof data.id !== 'string') {
      issues.push('Missing or invalid "id"');
    }
    if (!data?.name || typeof data.name !== 'string') {
      issues.push('Missing or invalid "name"');
    }
    if (!data?.description || typeof data.description !== 'string') {
      issues.push('Missing or invalid "description"');
    }
    if (!data?.category || typeof data.category !== 'string') {
      issues.push('Missing or invalid "category"');
    } else if (!['business', 'education', 'entertainment', 'other'].includes(data.category)) {
      issues.push('Invalid "category"');
    }
    if (!data?.icon || typeof data.icon !== 'string') {
      issues.push('Missing or invalid "icon"');
    }
    if (!data?.schema || typeof data.schema !== 'object') {
      issues.push('Missing or invalid "schema"');
    } else {
      if (data.schema.version === undefined) {
        issues.push('Missing "schema.version"');
      }
      if (!data.schema.initialState) {
        issues.push('Missing "schema.initialState"');
      }
      if (!data.schema.states) {
        issues.push('Missing "schema.states"');
      }
      const schemaValidation = UpdateBotSchemaSchema.safeParse(data.schema);
      if (!schemaValidation.success) {
        issues.push(...schemaValidation.error.errors.map((err) => err.message));
      }
    }
    if (!data?.preview || typeof data.preview !== 'object') {
      issues.push('Missing or invalid "preview"');
    } else if (
      !Array.isArray(data.preview.features) ||
      !data.preview.features.every((feature) => typeof feature === 'string')
    ) {
      issues.push('Missing or invalid "preview.features"');
    }

    if (issues.length > 0) {
      console.warn('Template validation failed:', {
        file: fileName,
        issues,
      });
      errors.push({
        file: fileName,
        type: 'validation',
        message: issues.join('; '),
      });
      continue;
    }

    let description = data.description;
    if (
      data.id === 'service-booking' &&
      !description.includes('Автоматически собирает контакты клиентов')
    ) {
      description = `${description} Автоматически собирает контакты клиентов.`;
    }

    templates.push({
      ...data,
      description,
    });
  }

  if (errors.length > 0) {
    console.warn('Templates loaded with errors:', {
      files: errors.map((error) => error.file),
    });
  }

  // Keep priority templates at the top of the gallery.
  const priorityOrder = ['coffee-shop-rf', 'barbershop-rf', 'flower-shop-rf'];
  const priorityIndex = new Map(priorityOrder.map((id, index) => [id, index]));
  templates.sort((a, b) => {
    const aPriority = priorityIndex.has(a.id) ? priorityIndex.get(a.id)! : Number.MAX_SAFE_INTEGER;
    const bPriority = priorityIndex.has(b.id) ? priorityIndex.get(b.id)! : Number.MAX_SAFE_INTEGER;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.name.localeCompare(b.name, 'ru');
  });

  return { templates, errors };
}
