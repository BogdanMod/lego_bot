'use client';

import { useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ownerGetTemplates, type TemplateMetadata } from '@/lib/api';

const INDUSTRIES = ['Все', 'Бизнес', 'Образование', 'Развлечения', 'Другое'];

export default function TemplatesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('Все');

  const { data, isLoading, error } = useQuery({
    queryKey: ['owner-templates'],
    queryFn: ownerGetTemplates,
  });

  const templates = useMemo(() => {
    if (!data?.items) return [];
    
    let filtered = data.items;
    
    // Filter by industry
    if (selectedIndustry !== 'Все') {
      filtered = filtered.filter((t) => t.industry === selectedIndustry);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.goal.toLowerCase().includes(query) ||
          t.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [data?.items, selectedIndustry, searchQuery]);

  if (isLoading) {
    return (
      <div className="panel p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
          <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-slate-200 dark:bg-slate-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel p-8">
        <div className="text-red-500">Ошибка загрузки шаблонов</div>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          Назад
        </button>
      </div>
    );
  }

  return (
    <div className="panel p-8">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="mb-4 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Назад
        </button>
        <h1 className="text-2xl font-semibold mb-4">Галерея шаблонов</h1>
        
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            placeholder="Поиск шаблонов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          <select
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          >
            {INDUSTRIES.map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </select>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {searchQuery || selectedIndustry !== 'Все'
            ? 'Шаблоны не найдены'
            : 'Нет доступных шаблонов'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onSelect={() => router.push(`/cabinet/bots/new?templateId=${template.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  onSelect,
}: {
  template: TemplateMetadata;
  onSelect: () => void;
}) {
  return (
    <div className="border rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
      <div className="mb-3">
        <div className="text-lg font-medium mb-1">{template.title}</div>
        <div className="text-xs text-muted-foreground">{template.industry}</div>
      </div>
      <div className="text-sm text-muted-foreground mb-3 line-clamp-2">
        {template.shortDescription}
      </div>
      {template.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {template.tags.slice(0, 3).map((tag, i) => (
            <span
              key={i}
              className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <button
        onClick={onSelect}
        className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm"
      >
        Выбрать
      </button>
    </div>
  );
}

