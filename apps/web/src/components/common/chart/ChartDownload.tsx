'use client';

import { useState, type RefObject } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { ChartSpec } from '@/utils/chartSpec';
import { chartFileName, chartSvgMarkup, downloadBlob, svgToPng } from '@/utils/chartExport';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Saves the chart drawn next to it as a file. The picture is built from the SVG in
// the page (see chartExport), so the button reads the rendered chart out of its
// container rather than drawing a second one.
export default function ChartDownload({
  chartRef,
  spec,
}: {
  chartRef: RefObject<HTMLDivElement | null>;
  spec: ChartSpec;
}) {
  const t = useTranslations('common.chart');
  const [saving, setSaving] = useState(false);

  async function save(format: 'svg' | 'png') {
    const chart = chartRef.current?.querySelector('svg');
    if (!chart) return;
    setSaving(true);
    try {
      const markup = chartSvgMarkup(chart, spec);
      const blob =
        format === 'svg'
          ? new Blob([markup], { type: 'image/svg+xml;charset=utf-8' })
          : await svgToPng(markup);
      downloadBlob(blob, chartFileName(spec, format));
    } catch {
      toast.error(t('downloadFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={saving}
          title={t('download')}
          aria-label={t('download')}
          className="ms-auto shrink-0 rounded p-1 text-muted-foreground/60 transition-colors hover:text-foreground disabled:opacity-50"
        >
          <Download className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => save('png')}>PNG</DropdownMenuItem>
        <DropdownMenuItem onClick={() => save('svg')}>SVG</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
