// Marks drawn over an image: a highlighter stroke, a rectangle or an ellipse.
// Coordinates are in the image's own pixels, so what is drawn survives the
// scaling the canvas is displayed at.

export type AnnotationTool = 'marker' | 'rect' | 'ellipse';

export type Annotation = {
  tool: AnnotationTool;
  color: string;
  // The whole stroke for the marker; the two opposite corners for a shape.
  points: { x: number; y: number }[];
};

export const ANNOTATION_COLORS = ['#ef4444', '#eab308', '#22c55e', '#3b82f6'];

// A mark has to read the same on a phone screenshot and on a 4K one, so the
// stroke is a fraction of the image rather than a fixed number of pixels.
const strokeWidth = (canvas: HTMLCanvasElement) =>
  Math.max(2, Math.round(Math.min(canvas.width, canvas.height) / 200));

function drawAnnotation(ctx: CanvasRenderingContext2D, a: Annotation, width: number) {
  const start = a.points[0];
  const end = a.points[a.points.length - 1];
  ctx.save();
  ctx.strokeStyle = a.color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (a.tool === 'marker') {
    // Wide and translucent, so the text under it stays readable.
    ctx.lineWidth = width * 5;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    for (const point of a.points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.stroke();
  } else if (a.tool === 'rect') {
    ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
  } else {
    ctx.beginPath();
    ctx.ellipse(
      (start.x + end.x) / 2,
      (start.y + end.y) / 2,
      Math.abs(end.x - start.x) / 2,
      Math.abs(end.y - start.y) / 2,
      0,
      0,
      2 * Math.PI,
    );
    ctx.stroke();
  }
  ctx.restore();
}

export function drawAnnotations(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  annotations: Annotation[],
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);
  const width = strokeWidth(canvas);
  for (const a of annotations) drawAnnotation(ctx, a, width);
}
