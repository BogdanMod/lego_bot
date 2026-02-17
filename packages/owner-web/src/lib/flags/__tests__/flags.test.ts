/**
 * Feature flags tests
 */

describe('isOwnerWizardEnabled', () => {
  const originalEnv = process.env.ENABLE_OWNER_WIZARD;

  afterEach(() => {
    // Restore original env
    if (originalEnv !== undefined) {
      process.env.ENABLE_OWNER_WIZARD = originalEnv;
    } else {
      delete process.env.ENABLE_OWNER_WIZARD;
    }
  });

  it('should return true when ENABLE_OWNER_WIZARD=1', () => {
    process.env.ENABLE_OWNER_WIZARD = '1';
    // Dynamic import to get fresh module
    const { isOwnerWizardEnabled } = require('../../flags');
    expect(isOwnerWizardEnabled()).toBe(true);
  });

  it('should return false when ENABLE_OWNER_WIZARD is not set', () => {
    delete process.env.ENABLE_OWNER_WIZARD;
    const { isOwnerWizardEnabled } = require('../../flags');
    expect(isOwnerWizardEnabled()).toBe(false);
  });

  it('should return false when ENABLE_OWNER_WIZARD is empty string', () => {
    process.env.ENABLE_OWNER_WIZARD = '';
    const { isOwnerWizardEnabled } = require('../../flags');
    expect(isOwnerWizardEnabled()).toBe(false);
  });

  it('should return false when ENABLE_OWNER_WIZARD is "0"', () => {
    process.env.ENABLE_OWNER_WIZARD = '0';
    const { isOwnerWizardEnabled } = require('../../flags');
    expect(isOwnerWizardEnabled()).toBe(false);
  });

  it('should return false when ENABLE_OWNER_WIZARD is "true"', () => {
    process.env.ENABLE_OWNER_WIZARD = 'true';
    const { isOwnerWizardEnabled } = require('../../flags');
    expect(isOwnerWizardEnabled()).toBe(false);
  });

  it('should return false when ENABLE_OWNER_WIZARD is "yes"', () => {
    process.env.ENABLE_OWNER_WIZARD = 'yes';
    const { isOwnerWizardEnabled } = require('../../flags');
    expect(isOwnerWizardEnabled()).toBe(false);
  });
});

