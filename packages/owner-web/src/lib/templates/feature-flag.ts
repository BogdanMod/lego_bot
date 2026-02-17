/**
 * Feature flag for Owner Wizard
 */

/**
 * Check if Owner Wizard is enabled
 * Server-side: checks process.env.ENABLE_OWNER_WIZARD
 * Client-side: checks NEXT_PUBLIC_ENABLE_OWNER_WIZARD
 */
export function isOwnerWizardEnabled(): boolean {
  if (typeof window === 'undefined') {
    // Server-side
    return process.env.ENABLE_OWNER_WIZARD === '1';
  } else {
    // Client-side
    return process.env.NEXT_PUBLIC_ENABLE_OWNER_WIZARD === '1';
  }
}

