import type { StudioAspect, StudioLayout, StudioTemplate } from '@/lib/api';

// The post image is drawn here rather than generated, which is what makes two
// posts on one template come out with the same composition. The template supplies
// only colours, the font and which layout to draw; every measurement is fixed
// below.
//
// The four layouts share one text model: `lead` is the quieter line above the
// headline, `headline` is the statement, `subtext` is the supporting line. What
// each layout does with them differs, and the composer labels the fields to match.

export const ASPECT_SIZES: Record<StudioAspect, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
};

export interface RenderInput {
  template: Pick<
    StudioTemplate,
    'layout' | 'aspect' | 'backgroundColor' | 'textColor' | 'accentColor' | 'fontFamily'
  >;
  lead: string;
  headline: string;
  subtext: string;
  chips: string[];
  ctaLabel: string;
  photo: HTMLImageElement | null;
}

const PAD = 88;

// Loads an image from a blob the API returned. A blob URL is same-origin, so the
// canvas stays untainted and can still be exported.
export function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The image could not be read'));
    };
    image.src = url;
  });
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The post image could not be exported'));
    }, 'image/png');
  });
}

function font(family: string, weight: number, size: number): string {
  return `${weight} ${size}px "${family}", system-ui, -apple-system, "Segoe UI", sans-serif`;
}

// Draws the image so it covers the box, cropping the overflowing side rather than
// distorting it.
function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  ctx.drawImage(
    image,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  ctx.restore();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

// Draws the wrapped text and returns the y just below the last line. Empty text
// draws nothing and hands the cursor back untouched.
function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  let cursor = y;
  for (const line of wrap(ctx, text, maxWidth)) {
    ctx.fillText(line, x, cursor);
    cursor += lineHeight;
  }
  return cursor;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// The lead line above the statement, both centred. Returns the y below the block.
function drawHeading(
  ctx: CanvasRenderingContext2D,
  input: RenderInput,
  w: number,
  top: number,
  size: number,
): number {
  const { template } = input;
  const maxWidth = w - PAD * 2;
  const lineHeight = Math.round(size * 1.18);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  let cursor = top;
  if (input.lead) {
    ctx.font = font(template.fontFamily, 400, size);
    ctx.fillStyle = template.accentColor;
    cursor = drawText(ctx, input.lead, w / 2, cursor, maxWidth, lineHeight);
  }
  if (input.headline) {
    ctx.font = font(template.fontFamily, 600, size);
    ctx.fillStyle = template.textColor;
    cursor = drawText(ctx, input.headline, w / 2, cursor, maxWidth, lineHeight);
  }
  return cursor;
}

function drawSubtext(
  ctx: CanvasRenderingContext2D,
  input: RenderInput,
  w: number,
  top: number,
): number {
  if (!input.subtext) return top;
  ctx.font = font(input.template.fontFamily, 400, 32);
  ctx.fillStyle = input.template.accentColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  return drawText(ctx, input.subtext, w / 2, top, w - PAD * 2.6, 44);
}

// A row of outlined pills, centred. Returns the y below the row.
function drawChips(
  ctx: CanvasRenderingContext2D,
  input: RenderInput,
  w: number,
  top: number,
): number {
  const labels = input.chips.filter((chip) => chip.trim().length > 0);
  if (labels.length === 0) return top;

  const height = 54;
  const gap = 16;
  ctx.font = font(input.template.fontFamily, 400, 24);
  const widths = labels.map((label) => ctx.measureText(label).width + 56);
  const total = widths.reduce((sum, width) => sum + width, 0) + gap * (labels.length - 1);

  let x = (w - total) / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  labels.forEach((label, index) => {
    roundedRect(ctx, x, top, widths[index], height, height / 2);
    ctx.strokeStyle = hexToRgba(input.template.accentColor, 0.45);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = input.template.accentColor;
    ctx.fillText(label, x + widths[index] / 2, top + height / 2 + 1);
    x += widths[index] + gap;
  });
  ctx.textBaseline = 'top';
  return top + height;
}

// The pill button at the bottom. The arrow marks it as a call to action.
function drawCta(
  ctx: CanvasRenderingContext2D,
  input: RenderInput,
  w: number,
  bottom: number,
): void {
  if (!input.ctaLabel) return;
  const label = `${input.ctaLabel}  ↗`;
  const height = 68;
  ctx.font = font(input.template.fontFamily, 400, 28);
  const width = ctx.measureText(label).width + 76;
  const x = (w - width) / 2;
  const y = bottom - height;

  roundedRect(ctx, x, y, width, height, height / 2);
  ctx.strokeStyle = hexToRgba(input.template.accentColor, 0.5);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = input.template.textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, w / 2, y + height / 2 + 1);
  ctx.textBaseline = 'top';
}

// A dark wash over a photo, so text on top of it stays readable.
function drawScrim(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
  gradient.addColorStop(0.45, 'rgba(0, 0, 0, 0.25)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

// Text at the top, the render squared off in the lower half.
function drawStatement(
  ctx: CanvasRenderingContext2D,
  input: RenderInput,
  w: number,
  h: number,
): void {
  ctx.fillStyle = input.template.backgroundColor;
  ctx.fillRect(0, 0, w, h);

  const afterHeading = drawHeading(ctx, input, w, Math.round(h * 0.1), 74);
  const afterText = drawSubtext(ctx, input, w, afterHeading + 34);

  if (input.photo) {
    const band = h - PAD - afterText;
    const size = Math.min(w - PAD * 2, band);
    if (size > 0) {
      drawCover(ctx, input.photo, (w - size) / 2, afterText + (band - size) / 2, size, size);
    }
  }
}

// Text, a row of pills, and a wide product shot filling the rest.
function drawFeature(
  ctx: CanvasRenderingContext2D,
  input: RenderInput,
  w: number,
  h: number,
): void {
  ctx.fillStyle = input.template.backgroundColor;
  ctx.fillRect(0, 0, w, h);

  const afterHeading = drawHeading(ctx, input, w, Math.round(h * 0.08), 68);
  const afterChips = drawChips(ctx, input, w, afterHeading + 34);
  const afterSubtext = drawSubtext(ctx, input, w, afterChips + 26);

  if (input.photo) {
    const top = afterSubtext + 48;
    const height = h - PAD - top;
    if (height > 0) drawCover(ctx, input.photo, PAD, top, w - PAD * 2, height);
  }
}

// An opening line, the message inside an outlined card, and a button below.
function drawAnnouncement(
  ctx: CanvasRenderingContext2D,
  input: RenderInput,
  w: number,
  h: number,
): void {
  const { template } = input;
  ctx.fillStyle = template.backgroundColor;
  ctx.fillRect(0, 0, w, h);
  if (input.photo) {
    drawCover(ctx, input.photo, 0, 0, w, h);
    drawScrim(ctx, w, h);
    ctx.fillStyle = hexToRgba(template.backgroundColor, 0.45);
    ctx.fillRect(0, 0, w, h);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  let cursor = Math.round(h * 0.14);
  if (input.lead) {
    ctx.font = font(template.fontFamily, 400, 56);
    ctx.fillStyle = template.textColor;
    cursor = drawText(ctx, input.lead, w / 2, cursor, w - PAD * 2, 68);
  }

  const cardTop = cursor + 56;
  const cardHeight = Math.round(h * 0.28);
  roundedRect(ctx, PAD, cardTop, w - PAD * 2, cardHeight, 10);
  ctx.fillStyle = hexToRgba(template.backgroundColor, 0.55);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(template.accentColor, 0.55);
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.font = font(template.fontFamily, 500, 54);
  ctx.fillStyle = template.textColor;
  ctx.textAlign = 'center';
  const afterHeadline = drawText(
    ctx,
    input.headline,
    w / 2,
    cardTop + Math.round(cardHeight * 0.24),
    w - PAD * 3,
    66,
  );
  drawSubtext(ctx, input, w, afterHeadline + 22);

  drawCta(ctx, input, w, h - PAD);
}

// The photo across the whole plate, the message large across the bottom.
function drawOverlay(
  ctx: CanvasRenderingContext2D,
  input: RenderInput,
  w: number,
  h: number,
): void {
  const { template } = input;
  ctx.fillStyle = template.backgroundColor;
  ctx.fillRect(0, 0, w, h);
  if (input.photo) {
    drawCover(ctx, input.photo, 0, 0, w, h);
    drawScrim(ctx, w, h);
  }

  drawHeading(ctx, input, w, Math.round(h * 0.07), 62);

  if (input.subtext) {
    ctx.font = font(template.fontFamily, 700, 78);
    ctx.fillStyle = template.textColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const lines = wrap(ctx, input.subtext, w - PAD * 2);
    let cursor = h - PAD - lines.length * 88;
    for (const line of lines) {
      ctx.fillText(line, PAD, cursor);
      cursor += 88;
    }
  }
}

const LAYOUTS: Record<
  StudioLayout,
  (ctx: CanvasRenderingContext2D, input: RenderInput, w: number, h: number) => void
> = {
  statement: drawStatement,
  feature: drawFeature,
  announcement: drawAnnouncement,
  overlay: drawOverlay,
};

export function renderPost(canvas: HTMLCanvasElement, input: RenderInput): void {
  const { width, height } = ASPECT_SIZES[input.template.aspect];
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  LAYOUTS[input.template.layout](ctx, input, width, height);
}
