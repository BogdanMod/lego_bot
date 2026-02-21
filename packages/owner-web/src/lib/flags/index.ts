/**
 * Feature flags (server-side only).
 * These flags are read from process.env and should NOT be exposed to client.
 */

/**
 * Check if Owner Wizard is enabled.
 * Server-side only - reads from process.env.ENABLE_OWNER_WIZARD.
 * Returns true only if ENABLE_OWNER_WIZARD === '1'.
 */
export function isOwnerWizardEnabled(): boolean {
  return process.env.ENABLE_OWNER_WIZARD === '1';
}
