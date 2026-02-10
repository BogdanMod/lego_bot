import type { Brick } from '../types';
import { validateBrickTransitions } from './brick-helpers';

export type ValidationErrorKey = 'noStart' | 'emptyContent' | 'noButtons' | 'invalidTransition';

export interface ValidationError {
  brickId: string;
  key: ValidationErrorKey;
}

export function validateBricks(bricks: Brick[]): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check for start brick
  const startBricks = bricks.filter((b) => b.type === 'start');
  if (startBricks.length === 0) {
    errors.push({ brickId: '', key: 'noStart' });
  }

  // Check each brick
  for (const brick of bricks) {
    // Check content
    if (!brick.content || brick.content.trim().length === 0) {
      errors.push({ brickId: brick.id, key: 'emptyContent' });
    }

    // Check menu options
    if (brick.type === 'menu') {
      if (!brick.options || brick.options.length === 0) {
        errors.push({ brickId: brick.id, key: 'noButtons' });
      } else {
        for (const opt of brick.options) {
          if (!opt.text || opt.text.trim().length === 0) {
            errors.push({ brickId: brick.id, key: 'emptyContent' });
          }
        }
      }
    }
  }

  // Check transitions
  const transitionValidation = validateBrickTransitions(bricks);
  if (!transitionValidation.valid) {
    errors.push({ brickId: '', key: 'invalidTransition' });
  }

  // De-duplicate messages (we only surface i18n messages by key)
  const seen = new Set<ValidationErrorKey>();
  return errors.filter((e) => {
    if (seen.has(e.key)) return false;
    seen.add(e.key);
    return true;
  });
}
