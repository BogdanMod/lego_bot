import { useEffect, useRef, useState } from 'react';
import type { Brick } from '../types';

interface BrickConnectionLinesProps {
  bricks: Brick[];
}

type Line = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

function escapeForAttributeSelector(value: string): string {
  const cssAny = (globalThis as any).CSS;
  if (cssAny && typeof cssAny.escape === 'function') {
    return cssAny.escape(value);
  }
  return value.replace(/["\\]/g, '\\$&');
}

export function BrickConnectionLines({ bricks }: BrickConnectionLinesProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  useEffect(() => {
    const svg = svgRef.current;
    const container = svg?.parentElement;
    if (!svg || !container) return;

    let rafId = 0;
    const compute = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const containerRect = container.getBoundingClientRect();
        const width = containerRect.width;
        const height = containerRect.height;
        setSize({ width, height });

        const findEl = (brickId: string): HTMLElement | null => {
          const sel = `[data-brick-id="${escapeForAttributeSelector(brickId)}"]`;
          return container.querySelector(sel) as HTMLElement | null;
        };

        const getStartPoint = (el: HTMLElement) => {
          const r = el.getBoundingClientRect();
          return {
            x: r.left + r.width / 2 - containerRect.left,
            y: r.bottom - containerRect.top,
          };
        };

        const getEndPoint = (el: HTMLElement) => {
          const r = el.getBoundingClientRect();
          return {
            x: r.left + r.width / 2 - containerRect.left,
            y: r.top - containerRect.top,
          };
        };

        const newLines: Line[] = [];
        for (const brick of bricks) {
          const fromEl = findEl(brick.id);
          if (!fromEl) continue;

          const targets: string[] = [];
          if (brick.nextId) targets.push(brick.nextId);
          for (const opt of brick.options || []) {
            if (opt.targetId) targets.push(opt.targetId);
          }

          for (const targetId of targets) {
            if (!targetId || targetId === brick.id) continue;
            const toEl = findEl(targetId);
            if (!toEl) continue;

            const p1 = getStartPoint(fromEl);
            const p2 = getEndPoint(toEl);
            newLines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
          }
        }

        setLines(newLines);
      });
    };

    compute();

    const onResize = () => compute();
    window.addEventListener('resize', onResize);

    const ro = new ResizeObserver(() => compute());
    ro.observe(container);
    for (const brick of bricks) {
      const el = container.querySelector(`[data-brick-id="${escapeForAttributeSelector(brick.id)}"]`) as HTMLElement | null;
      if (el) ro.observe(el);
    }

    return () => {
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [bricks]);

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      width="100%"
      height="100%"
      viewBox={`0 0 ${size.width} ${size.height}`}
      preserveAspectRatio="none"
    >
      <defs>
        <marker
          id="brick-connection-arrow"
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(99, 102, 241, 0.35)" />
        </marker>
      </defs>
      {lines.map((line, idx) => (
        <line
          key={idx}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="rgba(99, 102, 241, 0.3)"
          strokeWidth="2"
          strokeDasharray="5,5"
          markerEnd="url(#brick-connection-arrow)"
        />
      ))}
    </svg>
  );
}
