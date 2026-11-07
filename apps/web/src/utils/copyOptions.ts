// A part of a project a copy can carry over, and what it needs carried with it: a view,
// an action or an issue template points at states, types, labels and fields, and a
// schedule belongs to an agent and a state. Mirrors the API's normalizeInclude.
export interface CopyOption {
  key: string;
  label: string;
  requires: string[];
  // Whether a project template carries it.
  template: boolean;
}

export interface CopyGroup {
  key: string;
  title: string;
  options: CopyOption[];
}

// The reader's choices. An option left out of it is selected, so one the hosted build
// adds after the first render starts selected like the rest.
export type CopyInclude = Record<string, boolean>;

export const copyOptionsOf = (columns: CopyGroup[][]): CopyOption[] =>
  columns.flat().flatMap((group) => group.options);

export const isIncluded = (include: CopyInclude, key: string): boolean => include[key] !== false;

// The selection the API takes: every option shown, on or off.
export function includeOf(columns: CopyGroup[][], include: CopyInclude): Record<string, boolean> {
  return Object.fromEntries(
    copyOptionsOf(columns).map((option) => [option.key, isIncluded(include, option.key)]),
  );
}

// Checking an option checks what it requires; clearing one clears what requires it.
export function toggleInclude(
  columns: CopyGroup[][],
  include: CopyInclude,
  key: string,
  checked: boolean,
): CopyInclude {
  const options = copyOptionsOf(columns);
  const requires = (k: string) => options.find((option) => option.key === k)?.requires ?? [];
  const next = { ...include, [key]: checked };
  if (checked) {
    const stack = [...requires(key)];
    while (stack.length) {
      const dep = stack.pop()!;
      if (!isIncluded(next, dep)) next[dep] = true;
      stack.push(...requires(dep));
    }
  } else {
    let changed = true;
    while (changed) {
      changed = false;
      for (const option of options) {
        if (isIncluded(next, option.key) && option.requires.some((dep) => !isIncluded(next, dep))) {
          next[option.key] = false;
          changed = true;
        }
      }
    }
  }
  return next;
}
