// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useProjectSync } from '../useProjectSync';
import * as api from '../../utils/api';

vi.mock('../../utils/api');

describe('useProjectSync', () => {
  it('should auto-save after debounce delay', async () => {
    const mockProject = {
      id: 'test-1',
      serverId: 'test-1',
      name: 'Test',
      bricks: [],
      lastModified: Date.now(),
      status: 'draft' as const,
    };

    const updateSpy = vi.spyOn(api.api, 'updateBotProject');
    
    const { result, rerender } = renderHook(
      ({ project }) => useProjectSync(project),
      { initialProps: { project: mockProject } }
    );

    expect(result.current.syncStatus).toBe('idle');

    // Update project
    const updated = { ...mockProject, name: 'Updated' };
    rerender({ project: updated });

    // Should not save immediately
    expect(updateSpy).not.toHaveBeenCalled();

    // Wait for debounce
    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(updated);
    }, { timeout: 6000 });

    expect(result.current.syncStatus).toBe('idle');
  });

  it('should handle sync errors', async () => {
    const mockProject = {
      id: 'test-1',
      serverId: 'test-1',
      name: 'Test',
      bricks: [],
      lastModified: Date.now(),
      status: 'draft' as const,
    };

    vi.spyOn(api.api, 'updateBotProject').mockRejectedValue(
      new Error('Network error')
    );

    const { result } = renderHook(() => useProjectSync(mockProject));

    await waitFor(() => {
      expect(result.current.syncStatus).toBe('error');
      expect(result.current.error).toBeTruthy();
    }, { timeout: 6000 });
  });
});
