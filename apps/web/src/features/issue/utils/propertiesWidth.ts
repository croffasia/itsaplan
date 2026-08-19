// The dragged width of the Properties sidebar is a client-only preference, kept
// per project so each of them keeps the room its fields need.
export const PROPERTIES_W = 340;
export const PROPERTIES_MIN_W = 260;
export const PROPERTIES_MAX_W = 560;

export function propertiesWidthKey(projectKey: string): string {
  return `issue-properties-width:${projectKey}`;
}
