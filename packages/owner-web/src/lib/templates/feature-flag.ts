/**
 * Feature flag for Owner Wizard
 * @deprecated Use @/lib/flags instead
 * This file is kept for backward compatibility but should not be used in new code
 */

import { isOwnerWizardEnabled as getFlag } from '@/lib/flags';

/**
 * Check if Owner Wizard is enabled
 * @deprecated Use isOwnerWizardEnabled from @/lib/flags instead
 */
export function isOwnerWizardEnabled(): boolean {
  // Delegate to the new flags module
  return getFlag();
}

