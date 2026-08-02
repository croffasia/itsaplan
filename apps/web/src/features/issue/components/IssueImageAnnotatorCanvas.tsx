'use client';

import { useEffect, useState, type PointerEvent, type RefObject } from 'react';
import { drawAnnotations, type Annotation, type AnnotationTool } from '../utils/annotations';
import { cn } from '@/lib/utils';

// The image with the marks on it, drawn at the image's own resolution and scaled
// down for display, so what is saved is as sharp as what was uploaded.
export default function IssueImageAnnotatorCanvas({
  canvasRef,
  className,
  image,
  tool,
  color,
  annotations,
  onDraw,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  // How tall the image may get, which the dialog decides.
  className: string;
  image: HTMLImageElement;
  tool: AnnotationTool;
  color: string;
  annotations: Annotation[];
  onDraw: (annotation: Annotation) => void;
}) {
  // The mark being drawn right now: shown with the others, kept apart from them
  // until the pointer is released.
  const [drawing, setDrawing] = useState<Annotation | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      drawAnnotations(canvasRef.current, image, drawing ? [...annotations, drawing] : annotations);
    }
  }, [canvasRef, image, annotations, drawing]);

  function pointAt(e: PointerEvent<HTMLCanvasElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const scale = e.currentTarget.width / box.width;
    return { x: (e.clientX - box.left) * scale, y: (e.clientY - box.top) * scale };
  }

  return (
    <canvas
      ref={canvasRef}
      width={image.naturalWidth}
      height={image.naturalHeight}
      className={cn('max-w-full cursor-crosshair touch-none rounded-sm', className)}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrawing({ tool, color, points: [pointAt(e)] });
      }}
      onPointerMove={(e) => {
        if (!drawing) return;
        const point = pointAt(e);
        setDrawing({
          ...drawing,
          points:
            drawing.tool === 'marker' ? [...drawing.points, point] : [drawing.points[0], point],
        });
      }}
      onPointerUp={() => {
        // A click that never moved leaves no mark.
        if (drawing && drawing.points.length > 1) onDraw(drawing);
        setDrawing(null);
      }}
    />
  );
}
