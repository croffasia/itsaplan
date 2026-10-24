import type { ComponentType, Ref } from 'react';
import type { IconHandle } from '@animateicons/react';

// An icon of @animateicons/react. The control it sits in plays it through the ref
// that useIconHover hands out, so hovering anywhere on the control animates it.
export type AnimatedIcon = ComponentType<{
  size?: number;
  className?: string;
  ref?: Ref<IconHandle>;
}>;
