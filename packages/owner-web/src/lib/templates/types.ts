/**
 * Template Engine Types
 * Backward compatible with existing bot schema format
 */

// BotSchema type - compatible with existing format
export interface BotSchema {
  version: 1;
  initialState: string;
  states: {
    [key: string]: {
      message: string;
      buttons?: Array<{
        text: string;
        nextState: string;
        type?: string;
      }>;
      [key: string]: unknown;
    };
  };
}

export interface TemplateManifest {
  id: string;
  name: string;
  description: string;
  icon: string;
  version: string;
  category: 'business' | 'education' | 'entertainment' | 'other';
}

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  fields: WizardField[];
}

export interface WizardField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'phone' | 'email' | 'url' | 'number' | 'select' | 'checkbox' | 'multiselect';
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: Array<{ value: string; label: string }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface WizardConfig {
  steps: WizardStep[];
  modules: {
    handoff?: boolean;
    schedule?: boolean;
    faq?: boolean;
    payments?: boolean;
    catalog?: boolean;
    leads?: boolean;
  };
}

export interface TemplateAnswers {
  [key: string]: string | string[] | boolean | number;
}

export interface BotConfig {
  schema: BotSchema;
  metadata?: {
    template?: {
      id: string;
      version: string;
    };
    [key: string]: unknown;
  };
}

export interface TemplateDefinition {
  manifest: TemplateManifest;
  wizard: WizardConfig;
  buildBotConfig: (answers: TemplateAnswers) => BotConfig;
}

