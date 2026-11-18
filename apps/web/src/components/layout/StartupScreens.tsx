import type { ComponentType, ReactNode } from 'react';
import StartupScreensGate from './StartupScreensGate';

// A screen a signed-in person may meet over the page they land on. It renders nothing
// while it checks whether it is due, `next` when it is not, and itself when it is;
// closed, it renders `next`. The list is built once, when the module loads, so whether a
// screen is due is the screen's own rule.
export interface StartupScreen {
  id: string;
  Component: ComponentType<{ next: ReactNode }>;
}

// Shows the first screen that is due, one at a time, in list order.
export default function StartupScreens({ screens }: { screens: StartupScreen[] }) {
  return (
    <StartupScreensGate>
      {screens.reduceRight<ReactNode>(
        (next, { id, Component }) => (
          <Component key={id} next={next} />
        ),
        null,
      )}
    </StartupScreensGate>
  );
}
