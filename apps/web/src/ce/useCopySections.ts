'use client';

import type { CopyGroup } from '@/utils/copyOptions';

// A self-hosted instance copies the core's parts of a project. The hosted build returns
// the core's columns with options of its own, in a group of the core's or its own; the
// api copies them through the sections it adds (setCopySections).
export default function useCopySections(core: CopyGroup[][]): CopyGroup[][] {
  return core;
}
