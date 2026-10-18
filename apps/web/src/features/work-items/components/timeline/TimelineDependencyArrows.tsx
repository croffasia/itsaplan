import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { BoardIssue } from '@/lib/api/endpoints/issues';
import { useBoardIssueMap } from '../../context/useSubtasks';
import { dependencyPath } from '../../utils/timelineDependencies';

interface Arrow {
  key: string;
  d: string;
  blocked: boolean;
}

// Draws the Gantt dependency arrows over the timeline: one from each issue to every
// issue it blocks, end to start. The bars are found by their data-timeline-bar
// attribute and measured after layout, because row heights depend on folded
// subtasks and relation rows; the arrows follow when a bar is dragged or resized.
// The arrows are measured against the element the svg sits in, which is read from
// the svg itself: a ref the parent holds is not attached yet when this effect runs.
export function TimelineDependencyArrows() {
  // The board's issues, subtasks included: an arrow is drawn wherever both of its
  // bars are on screen.
  const issues = [...useBoardIssueMap().values()] as BoardIssue[];
  const svgRef = useRef<SVGSVGElement>(null);
  const [arrows, setArrows] = useState<Arrow[]>([]);

  // Keyed by the relations themselves, so a re-render with the same issues does not
  // re-measure (the effect sets state, which would otherwise loop).
  const pairKey = issues
    .flatMap((issue) =>
      issue.links
        .filter((link) => link.relation === 'blocks')
        .map((link) => `${issue.id}>${link.issueId}`),
    )
    .join(',');
  const pairs = useMemo(
    () =>
      pairKey
        ? pairKey.split(',').map((pair) => {
            const [from, to] = pair.split('>').map(Number);
            return { from, to };
          })
        : [],
    [pairKey],
  );

  useLayoutEffect(() => {
    const container = svgRef.current?.parentElement;
    if (!container) return;
    if (pairs.length === 0) {
      setArrows([]);
      return;
    }

    // Measured at most once per frame. A burst of mutations joins the frame already
    // scheduled instead of pushing it back, which would never let it run while the
    // page keeps changing.
    let frame = 0;
    const measure = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const box = container.getBoundingClientRect();
        const rectOf = (id: number) => {
          const el = container.querySelector<HTMLElement>(`[data-timeline-bar="${id}"]`);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return {
            left: r.left - box.left,
            right: r.right - box.left,
            midY: r.top - box.top + r.height / 2,
          };
        };
        const next: Arrow[] = [];
        for (const pair of pairs) {
          const from = rectOf(pair.from);
          const to = rectOf(pair.to);
          if (!from || !to) continue;
          next.push({
            key: `${pair.from}-${pair.to}`,
            d: dependencyPath(from, to),
            blocked: to.left < from.right,
          });
        }
        const sig = next.map((a) => a.d).join('|');
        setArrows((current) => (current.map((a) => a.d).join('|') === sig ? current : next));
      });
    };

    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(container);
    // A drag restyles the bar it moves; a folded subtask list changes row heights.
    const mutations = new MutationObserver(measure);
    mutations.observe(container, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['style'],
    });
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
    };
  }, [pairs]);

  return (
    <svg
      ref={svgRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 overflow-visible"
      width="100%"
      height="100%"
    >
      <defs>
        <marker
          id="timeline-dependency-head"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 z" fill="var(--muted-foreground)" />
        </marker>
        <marker
          id="timeline-dependency-head-late"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 z" fill="var(--destructive)" />
        </marker>
      </defs>
      {arrows.map((arrow) => (
        <path
          key={arrow.key}
          d={arrow.d}
          fill="none"
          strokeWidth={1.25}
          // A blocked issue that starts before its blocker ends is drawn in the
          // destructive color: the plan has it starting too early.
          stroke={arrow.blocked ? 'var(--destructive)' : 'var(--muted-foreground)'}
          markerEnd={`url(#${arrow.blocked ? 'timeline-dependency-head-late' : 'timeline-dependency-head'})`}
        />
      ))}
    </svg>
  );
}
