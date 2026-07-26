// Version comparison for the release list. The api decides whether an update
// exists; this splits the releases it returns into the ones above the running
// version and the ones at or below it.

function parts(value: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

// Whether `value` is a later release than `other`. Anything that is not a plain
// major.minor.patch counts as not newer, so it never lands in the "new" group.
export function isNewerVersion(value: string, other: string): boolean {
  const a = parts(value);
  const b = parts(other);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}
