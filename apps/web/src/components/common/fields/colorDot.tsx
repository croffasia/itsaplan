// The small round color swatch shown next to a state, label, issue type or
// custom-field option.
export const colorDot = (color: string) => (
  <span
    className="inline-block size-2.5 shrink-0 rounded-full"
    style={{ backgroundColor: color }}
  />
);
