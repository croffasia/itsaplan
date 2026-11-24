const DURATION = 650;
const STRIP_HEIGHT = 8;
// One keyframe per display frame, so the browser does not interpolate between the warps.
const STEPS = 40;
// The share of the time the funnel takes to form before the window slides into it.
const FUNNEL_SHARE = 0.3;

type Point = [number, number];

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const smooth = (n: number) => n * n * (3 - 2 * n);

// The projective transform that maps a box of the given size onto the quad top left, top
// right, bottom right, bottom left (Heckbert's square-to-quad), for `transform-origin: 0 0`.
export function quadMatrix(boxWidth: number, boxHeight: number, quad: Point[]): string {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / det;
  const h = (dx1 * dy3 - dx3 * dy1) / det;
  const a = (x1 - x0 + g * x1) / boxWidth;
  const b = (x3 - x0 + h * x3) / boxHeight;
  const d = (y1 - y0 + g * y1) / boxWidth;
  const e = (y3 - y0 + h * y3) / boxHeight;
  return `matrix3d(${a},${d},0,${g / boxWidth},${b},${e},0,${h / boxHeight},0,0,1,0,${x0},${y0},0,1)`;
}

// The tour closes into the product mark in the sidebar, the button that opens it again, as
// a window minimized to the macOS dock does: its edges bend into a funnel that narrows
// toward the mark, then it slides down the funnel. A copy of it is cut into horizontal
// strips, each warped onto the funnel between its top and bottom edge, so neighbouring
// strips meet and the edges stay smooth. With no mark below it (a phone, where the sidebar
// is a sheet) or with reduced motion it closes at once.
export function flyToMark(content: HTMLElement | null): Promise<void> {
  const mark = document.querySelector('[data-product-mark]')?.getBoundingClientRect();
  if (!content || !mark?.width || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return Promise.resolve();
  }
  const { left, top, width, height } = content.getBoundingClientRect();
  const markCentre = mark.top + mark.height / 2;
  const fall = markCentre - top;
  if (fall <= 0) return Promise.resolve();

  // The edges of a row at screen height y, relative to the window's left: the window's at
  // its top, the mark's at the mark, eased in by `bend` while the funnel forms.
  const edges = (y: number, bend: number): Point => {
    const f = smooth(clamp01((y - top) / fall)) * bend;
    const rowLeft = (mark.left - left) * f;
    const rowRight = width + (mark.right - left - width) * f;
    return [rowLeft, Math.max(rowLeft + 0.5, rowRight)];
  };

  // The copy shows the current slide only: the strip holding the others is scrolled in the
  // original, and a copy loses its scroll position.
  const copy = content.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('[inert]').forEach((node) => node.remove());
  copy.removeAttribute('data-state');
  Object.assign(copy.style, {
    position: 'absolute',
    left: '0',
    width: `${width}px`,
    height: `${height}px`,
    maxWidth: 'none',
    translate: 'none',
    animation: 'none',
  });

  const layer = document.createElement('div');
  layer.style.cssText = 'position:fixed;inset:0;z-index:60;pointer-events:none';
  // The strips copy the dialog's buttons and roles: no focus or screen reader reaches them.
  layer.inert = true;
  const timing = { duration: DURATION, fill: 'forwards' } as const;
  const animations: Animation[] = [];

  for (let offset = 0; offset < height; offset += STRIP_HEIGHT) {
    // One pixel taller than the step, so the edges of neighbouring strips overlap and no
    // seam shows between them.
    const stripHeight = Math.min(STRIP_HEIGHT + 1, height - offset);
    const stripTop = top + offset;
    const strip = document.createElement('div');
    strip.style.cssText = `position:fixed;left:${left}px;top:${stripTop}px;width:${width}px;height:${stripHeight}px;overflow:hidden;transform-origin:0 0`;
    const piece = copy.cloneNode(true) as HTMLElement;
    piece.style.top = `${-offset}px`;
    strip.append(piece);
    layer.append(strip);

    const frames: Keyframe[] = [];
    for (let step = 0; step <= STEPS; step++) {
      const t = step / STEPS;
      const bend = smooth(clamp01(t / FUNNEL_SHARE));
      const shift = clamp01((t - FUNNEL_SHARE) / (1 - FUNNEL_SHARE)) ** 2 * fall;
      const [topLeft, topRight] = edges(stripTop + shift, bend);
      const [bottomLeft, bottomRight] = edges(stripTop + shift + stripHeight, bend);
      frames.push({
        transform: quadMatrix(width, stripHeight, [
          [topLeft, shift],
          [topRight, shift],
          [bottomRight, shift + stripHeight],
          [bottomLeft, shift + stripHeight],
        ]),
        opacity: clamp01((markCentre - stripTop - shift) / (STRIP_HEIGHT * 2)),
      });
    }
    animations.push(strip.animate(frames, timing));
  }

  document.body.append(layer);
  content.style.visibility = 'hidden';
  const overlay = content.previousElementSibling;
  if (overlay?.getAttribute('data-slot') === 'dialog-overlay') {
    animations.push(overlay.animate([{ opacity: 1 }, { opacity: 0 }], timing));
  }

  const done = () => layer.remove();
  return Promise.all(animations.map((animation) => animation.finished)).then(done, done);
}
