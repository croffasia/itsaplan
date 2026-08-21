// Saving a chart the app drew. recharts renders to SVG in the page, so the file is
// that SVG lifted out of the document — with everything it inherited from the page
// written onto it, since a standalone file has no stylesheet, no theme variables, and
// no Tailwind classes behind it.
//
// The legend and the title are HTML next to the chart, not part of its SVG, so both
// are drawn into the exported picture from the spec instead of copied from the DOM.
// The PNG is that same SVG rasterized, so the two formats show the same thing.

import {
  chartHasLegend,
  chartLegend,
  type ChartLegendEntry,
  type ChartSpec,
} from '@/utils/chartSpec';

// What an element takes from the page rather than from its own attributes: recharts
// sets geometry as attributes but leaves color, weight, and font to CSS.
const INHERITED = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-opacity',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
];

const TITLE_HEIGHT = 28;
const LEGEND_HEIGHT = 24;
const LEGEND_SWATCH = 10;
const LEGEND_SWATCH_GAP = 5;
const LEGEND_GAP = 16;
const PADDING = 12;
// Rasterized at twice the drawn size, so the PNG stays sharp on a high-density screen.
const PNG_SCALE = 2;
const SVG_NS = 'http://www.w3.org/2000/svg';

function inlineStyles(source: Element, clone: Element): void {
  const from = [source, ...source.querySelectorAll('*')];
  const to = [clone, ...clone.querySelectorAll('*')];
  from.forEach((element, index) => {
    const target = to[index];
    if (!(target instanceof SVGElement) || !(element instanceof SVGElement)) return;
    const computed = getComputedStyle(element);
    for (const property of INHERITED) {
      target.style.setProperty(property, computed.getPropertyValue(property));
    }
  });
}

function element(name: string, attributes: Record<string, string | number>): SVGElement {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function text(value: string, attributes: Record<string, string | number>): SVGElement {
  const node = element('text', attributes);
  node.textContent = value;
  return node;
}

// The page background, so a chart saved in the dark theme is not light text on
// nothing. A transparent body means the default white page underneath it.
function pageBackground(): string {
  const color = getComputedStyle(document.body).backgroundColor;
  return !color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)' ? '#ffffff' : color;
}

// Rough advance per character: the exported file carries no layout engine to measure
// text with, and the legend only has to not overlap itself.
const CHAR_WIDTH = 7;

function entryWidth(entry: ChartLegendEntry): number {
  return LEGEND_SWATCH + LEGEND_SWATCH_GAP + entry.label.length * CHAR_WIDTH + LEGEND_GAP;
}

interface PlacedEntry extends ChartLegendEntry {
  x: number;
  row: number;
}

// Where every legend entry sits at the chart's width, and how many rows they wrap
// onto. The height the document reserves and the drawn entries both read this one
// layout, so they cannot disagree on where the legend ends.
function layoutLegend(
  entries: ChartLegendEntry[],
  width: number,
): { entries: PlacedEntry[]; rows: number } {
  const placed: PlacedEntry[] = [];
  let x = PADDING;
  let row = 0;
  for (const entry of entries) {
    if (x > PADDING && x + entryWidth(entry) > width - PADDING) {
      row++;
      x = PADDING;
    }
    placed.push({ ...entry, x, row });
    x += entryWidth(entry);
  }
  return { entries: placed, rows: placed.length ? row + 1 : 0 };
}

// The height recharts already left empty at the bottom of the chart's svg: it draws
// its own legend as HTML beside the svg but shrinks the plot inside it to make room.
function reservedLegendBand(chart: SVGSVGElement): number {
  const wrapper = chart.parentElement?.querySelector('.recharts-legend-wrapper');
  return wrapper?.getBoundingClientRect().height ?? 0;
}

function legend(entries: PlacedEntry[], top: number, foreground: string): SVGElement {
  const group = element('g', { 'font-size': 12, fill: foreground });
  for (const entry of entries) {
    const y = top + LEGEND_SWATCH + entry.row * LEGEND_HEIGHT;
    group.append(
      element('rect', {
        x: entry.x,
        y: y - LEGEND_SWATCH,
        width: LEGEND_SWATCH,
        height: LEGEND_SWATCH,
        rx: 2,
        fill: entry.color,
      }),
      text(entry.label, { x: entry.x + LEGEND_SWATCH + LEGEND_SWATCH_GAP, y }),
    );
  }
  return group;
}

// The chart as a standalone SVG document: the drawn chart with its inherited styles
// written in, under its title and over its legend.
export function chartSvgMarkup(chart: SVGSVGElement, spec: ChartSpec): string {
  const { width, height } = chart.getBoundingClientRect();
  const chartStyle = getComputedStyle(chart);
  const foreground = chartStyle.color || '#000000';
  const titleHeight = spec.title ? TITLE_HEIGHT : 0;
  const legendLayout = chartHasLegend(spec) ? layoutLegend(chartLegend(spec), width) : null;
  const legendHeight = (legendLayout?.rows ?? 0) * LEGEND_HEIGHT;
  // The drawn legend goes into the band the chart already reserved, so only the rows
  // that do not fit in it make the document taller.
  const reserved = legendLayout ? reservedLegendBand(chart) : 0;
  const total = titleHeight + height + Math.max(0, legendHeight - reserved) + PADDING * 2;

  const root = element('svg', {
    xmlns: SVG_NS,
    width,
    height: total,
    viewBox: `0 0 ${width} ${total}`,
    'font-family': chartStyle.fontFamily || 'sans-serif',
  });
  root.append(element('rect', { width, height: total, fill: pageBackground() }));

  if (spec.title) {
    root.append(
      text(spec.title, {
        x: PADDING,
        y: PADDING + 16,
        'font-size': 14,
        'font-weight': 600,
        fill: foreground,
      }),
    );
  }

  const clone = chart.cloneNode(true) as SVGSVGElement;
  inlineStyles(chart, clone);
  clone.setAttribute('x', '0');
  clone.setAttribute('y', String(PADDING + titleHeight));
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  root.append(clone);

  if (legendLayout) {
    root.append(
      legend(legendLayout.entries, PADDING + titleHeight + height - reserved, foreground),
    );
  }
  return new XMLSerializer().serializeToString(root);
}

export async function svgToPng(markup: string): Promise<Blob> {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width * PNG_SCALE;
  canvas.height = image.height * PNG_SCALE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable');
  context.scale(PNG_SCALE, PNG_SCALE);
  context.drawImage(image, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The chart could not be rasterized'))),
      'image/png',
    );
  });
}

export function chartFileName(spec: ChartSpec, extension: 'svg' | 'png'): string {
  const slug = (spec.title ?? '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'chart'}.${extension}`;
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Revoked on the next tick: Safari reads the URL after the click handler returns,
  // and a URL revoked in the same tick gives it nothing to save.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
