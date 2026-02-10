import { useEffect, useMemo, useState } from 'react';
import { INTEGRATION_TEMPLATES, IntegrationTemplateDefinition } from '../data/integration-templates';
import './IntegrationTemplateSelector.css';

interface IntegrationTemplateSelectorProps {
  selectedId?: IntegrationTemplateDefinition['id'];
  onApply: (template: IntegrationTemplateDefinition) => void;
}

export default function IntegrationTemplateSelector({
  selectedId,
  onApply,
}: IntegrationTemplateSelectorProps) {
  const [activeId, setActiveId] = useState<IntegrationTemplateDefinition['id']>(
    selectedId ?? 'custom'
  );

  useEffect(() => {
    if (selectedId) {
      setActiveId(selectedId);
    }
  }, [selectedId]);

  const activeTemplate = useMemo(
    () => INTEGRATION_TEMPLATES.find((template) => template.id === activeId) || INTEGRATION_TEMPLATES[0],
    [activeId]
  );

  return (
    <div className="integration-template-selector">
      <div className="integration-template-grid">
        {INTEGRATION_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            className={`integration-template-card ${activeId === template.id ? 'active' : ''}`}
            onClick={() => setActiveId(template.id)}
          >
            <div className="integration-template-icon">{template.icon}</div>
            <div className="integration-template-name">{template.name}</div>
            <div className="integration-template-desc">{template.description}</div>
          </button>
        ))}
      </div>

      <div className="integration-template-details">
        <div className="integration-template-title">
          {activeTemplate.icon} {activeTemplate.name}
        </div>
        <div className="integration-template-instructions">{activeTemplate.setupInstructions}</div>
        <button
          className="btn btn-secondary"
          onClick={() => onApply(activeTemplate)}
        >
          Применить шаблон
        </button>
      </div>
    </div>
  );
}
