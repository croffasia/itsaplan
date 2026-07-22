import type { Label, LabelGroup } from '@/lib/api';

// A group of labels for the pickers: either a real LabelGroup with its labels,
// or the ungrouped bucket (group === null). Empty groups are omitted so a group
// with no labels does not show an empty submenu.
export interface LabelSection {
  group: LabelGroup | null;
  labels: Label[];
}

// Splits a project's labels into their groups plus a trailing ungrouped section,
// the single source both label pickers read. Groups keep their listing order
// (name-sorted from the API); ungrouped labels come last. A group with no labels
// is dropped; the ungrouped section is included only when it has labels.
export function groupLabels(labels: Label[], groups: LabelGroup[]): LabelSection[] {
  const byGroup = new Map<number, Label[]>();
  const ungrouped: Label[] = [];
  for (const label of labels) {
    if (label.groupId == null) {
      ungrouped.push(label);
      continue;
    }
    const bucket = byGroup.get(label.groupId);
    if (bucket) bucket.push(label);
    else byGroup.set(label.groupId, [label]);
  }
  const sections: LabelSection[] = [];
  for (const group of groups) {
    const inGroup = byGroup.get(group.id);
    if (inGroup && inGroup.length) sections.push({ group, labels: inGroup });
  }
  if (ungrouped.length) sections.push({ group: null, labels: ungrouped });
  return sections;
}
