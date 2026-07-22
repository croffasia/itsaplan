// Wraps a directory filter setter so a change also rewinds paging: any filter change
// makes the current window meaningless, so the list goes back to the start.
export function withOffsetReset<T>(
  setOffset: (offset: number) => void,
  set: (value: T) => void,
): (value: T) => void {
  return (value) => {
    set(value);
    setOffset(0);
  };
}
