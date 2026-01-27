import { BotSchema } from '@dialogue-constructor/shared';

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

// Templates are stored as JSON for easy edits; this loader keeps the type-safe boundary.
export async function getTemplates(): Promise<BotTemplate[]> {
  const modules = import.meta.glob('/templates/*.json', { eager: true, as: 'raw' }) as Record<
    string,
    string
  >;
  const templates = Object.entries(modules).map(async ([path, raw]) => {
    const data: BotTemplate = JSON.parse(raw);
    return data;
  });
  const loaded = await Promise.all(templates);
  return loaded.map((template) => {
    if (
      template.id === 'service-booking' &&
      !template.description.includes('Автоматически собирает контакты клиентов')
    ) {
      return {
        ...template,
        description: `${template.description} Автоматически собирает контакты клиентов.`,
      };
    }
    return template;
  });
}
