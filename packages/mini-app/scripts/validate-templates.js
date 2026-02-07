import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { UpdateBotSchemaSchema } from '@dialogue-constructor/shared/server';

const templatesDir = path.resolve(process.cwd(), 'src/templates');
const decoder = new TextDecoder('utf-8', { fatal: true });

const reportError = (file, message, details) => {
  if (details) {
    console.error(`[${file}] ${message}`, details);
    return;
  }
  console.error(`[${file}] ${message}`);
};

const files = await readdir(templatesDir);
const jsonFiles = files.filter((file) => file.endsWith('.json'));
let hasErrors = false;

for (const file of jsonFiles) {
  const filePath = path.join(templatesDir, file);
  let rawBuffer;
  try {
    rawBuffer = await readFile(filePath);
  } catch (error) {
    reportError(file, 'Failed to read file', error);
    hasErrors = true;
    continue;
  }

  let raw;
  try {
    raw = decoder.decode(rawBuffer);
  } catch (error) {
    reportError(file, 'File is not valid UTF-8', error);
    hasErrors = true;
    continue;
  }

  if (raw.startsWith('﻿')) {
    reportError(file, 'UTF-8 BOM detected');
    hasErrors = true;
    raw = raw.replace(/^﻿/, '');
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    reportError(file, 'Invalid JSON', error);
    hasErrors = true;
    continue;
  }

  const issues = [];
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
    reportError(file, 'Template validation failed', { issues });
    hasErrors = true;
  }
}

if (hasErrors) {
  console.error('Template validation failed');
  process.exit(1);
}

console.log('Templates validation passed');
