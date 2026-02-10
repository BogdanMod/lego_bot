import type { Brick } from '../types';

export function findBrickById(bricks: Brick[], id: string): Brick | undefined {
  return bricks.find((b) => b.id === id);
}

export function getBrickDependencies(bricks: Brick[], brickId: string): string[] {
  const brick = findBrickById(bricks, brickId);
  if (!brick) return [];

  const deps: string[] = [];
  if (brick.nextId) deps.push(brick.nextId);
  if (brick.options) {
    for (const opt of brick.options) {
      if (opt.targetId) deps.push(opt.targetId);
    }
  }
  return deps;
}

export function getReferencingBricks(bricks: Brick[], targetBrickId: string): Brick[] {
  return bricks.filter((b) => {
    if (b.nextId === targetBrickId) return true;
    return (b.options || []).some((opt) => opt.targetId === targetBrickId);
  });
}

export function getNextBrick(bricks: Brick[], currentBrick: Brick, optionIndex?: number): Brick | null {
  if (currentBrick.type === 'menu') {
    if (optionIndex === undefined) return null;
    const targetId = currentBrick.options?.[optionIndex]?.targetId;
    if (!targetId) return null;
    return findBrickById(bricks, targetId) || null;
  }

  const nextId = currentBrick.nextId;
  if (!nextId) return null;
  return findBrickById(bricks, nextId) || null;
}

export function reorderBricks(bricks: Brick[], fromIndex: number, toIndex: number): Brick[] {
  const list = [...bricks];
  if (fromIndex < 0 || fromIndex >= list.length) return list;
  if (toIndex < 0 || toIndex >= list.length) return list;

  const [item] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, item);
  return list;
}

export function generateBrickId(): string {
  return `brick_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function generateId(): string {
  return generateBrickId();
}

export function regenerateBrickIds(bricks: Brick[]): Brick[] {
  const idMap = new Map<string, string>();

  // Generate new IDs
  bricks.forEach((brick) => {
    const newId = generateId();
    idMap.set(brick.id, newId);
  });

  // Update all references
  return bricks.map((brick) => ({
    ...brick,
    id: idMap.get(brick.id)!,
    nextId: brick.nextId ? idMap.get(brick.nextId) : undefined,
    options: brick.options?.map((opt) => ({
      ...opt,
      targetId: opt.targetId ? idMap.get(opt.targetId) : undefined,
    })),
  }));
}

export function validateBrickTransitions(bricks: Brick[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const ids = new Set(bricks.map((b) => b.id));

  const startBricks = bricks.filter((b) => b.type === 'start');
  if (startBricks.length === 0) {
    errors.push('No start brick found');
  }

  for (const b of bricks) {
    if (b.nextId && !ids.has(b.nextId)) {
      errors.push(`Brick "${b.id}" has invalid nextId "${b.nextId}"`);
    }
    if (b.options) {
      for (const opt of b.options) {
        if (opt.targetId && !ids.has(opt.targetId)) {
          errors.push(`Brick "${b.id}" has invalid option targetId "${opt.targetId}"`);
        }
      }
    }
  }

  // Orphan detection: bricks unreachable from any start brick.
  if (startBricks.length > 0) {
    const reachable = new Set<string>();
    const queue: string[] = startBricks.map((b) => b.id);
    for (const id of queue) reachable.add(id);

    while (queue.length > 0) {
      const currentId = queue.shift() as string;
      const current = findBrickById(bricks, currentId);
      if (!current) continue;

      const deps = getBrickDependencies(bricks, current.id);
      for (const dep of deps) {
        if (!dep) continue;
        if (!ids.has(dep)) continue;
        if (reachable.has(dep)) continue;
        reachable.add(dep);
        queue.push(dep);
      }
    }

    const orphans = bricks.filter((b) => !reachable.has(b.id));
    for (const o of orphans) {
      errors.push(`Orphaned brick "${o.id}" is not reachable from start`);
    }
  }

  return { valid: errors.length === 0, errors };
}
