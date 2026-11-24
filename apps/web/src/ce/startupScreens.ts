import type { StartupScreen } from '@/components/layout/StartupScreens';

// A self-hosted instance shows the core's startup screens. The hosted build returns the
// core's with its own added at any position, or with one replaced or left out.
export default function startupScreens(core: StartupScreen[]): StartupScreen[] {
  return core;
}
