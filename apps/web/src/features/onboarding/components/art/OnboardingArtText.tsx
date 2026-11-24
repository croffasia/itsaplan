import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// A line of picture text cut at a width, so a translation longer than the English stays
// inside its card. `y` is the baseline, as for a plain <text>.
export default function OnboardingArtText({
  x,
  y,
  width,
  size,
  weight = 500,
  className,
  children,
}: {
  x: number;
  y: number;
  width: number;
  size: number;
  weight?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg x={x} y={y - size} width={width} height={size * 1.6} overflow="hidden">
      <text
        y={size}
        fontSize={size}
        fontWeight={weight}
        className={cn('fill-foreground', className)}
      >
        {children}
      </text>
    </svg>
  );
}
