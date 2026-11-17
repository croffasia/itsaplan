// How a horizontal pointer move maps onto a line of `el`: 1 when moving right goes toward
// the line's end, -1 in a right-to-left layout, where the end is on the left.
export function inlineSign(el: Element): 1 | -1 {
  return getComputedStyle(el).direction === 'rtl' ? -1 : 1;
}
