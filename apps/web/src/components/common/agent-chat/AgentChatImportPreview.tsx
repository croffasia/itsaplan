'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CirclePlus, CircleX } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const COLLAPSED_ROWS = 5;

// The rows of the file with the field each column feeds, so the reviewer sees real
// content before confirming. The server sends only the mapped columns — a file
// exported from a tracker repeats a column per value it holds and runs into the
// thousands — and every row, so the whole import can be checked here. A row the
// confirm would pass over carries the reason it will report.
export function AgentChatImportPreview({
  columns,
  rows,
}: {
  columns: { field: string; header: string }[];
  rows: { cells: string[]; skip: string | null }[];
}) {
  const t = useTranslations('common.agentChat');
  const [expanded, setExpanded] = useState(false);

  if (columns.length === 0) return null;
  // The rows that will be created come first: what the confirm does is the point of
  // the card, and the skipped ones only have to be findable.
  const ordered = [...rows].sort((a, b) => Number(Boolean(a.skip)) - Number(Boolean(b.skip)));
  const shown = expanded ? ordered : ordered.slice(0, COLLAPSED_ROWS);

  return (
    <div className="flex flex-col gap-2">
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full border-collapse text-sm" dir="auto">
          <thead className="sticky top-0 bg-background">
            <tr>
              <th className="border-b px-2 py-1.5 text-start font-medium whitespace-nowrap">
                {t('importRowState')}
              </th>
              {columns.map(({ field, header }) => (
                <th
                  key={field}
                  className="border-b px-2 py-1.5 text-start font-medium whitespace-nowrap"
                >
                  {header}
                  <span className="ms-1 rounded bg-muted px-1 py-0.5 align-middle text-[10px] tracking-wide text-muted-foreground uppercase">
                    {field}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, rowIndex) => {
              const state = row.skip ?? t('importRowNew');
              return (
                <tr key={rowIndex} className={cn(row.skip && 'text-muted-foreground')}>
                  <td className="border-b px-2 py-1.5 align-top">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          {row.skip ? (
                            <CircleX className="size-4 text-muted-foreground" />
                          ) : (
                            <CirclePlus className="size-4 text-green-600" />
                          )}
                          <span className="sr-only">{state}</span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{state}</TooltipContent>
                    </Tooltip>
                  </td>
                  {columns.map(({ field }, cellIndex) => (
                    <td key={field} className="border-b px-2 py-1.5 align-top">
                      <div className="max-w-[220px] truncate">{row.cells[cellIndex]}</div>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.some((row) => row.skip) && (
        <p className="text-xs text-muted-foreground">{t('importSkipHint')}</p>
      )}
      {rows.length > COLLAPSED_ROWS && (
        <button
          type="button"
          className="self-start text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          onClick={() => setExpanded((on) => !on)}
        >
          {expanded
            ? t('importShowFewerRows', { count: COLLAPSED_ROWS })
            : t('importShowAllRows', { count: rows.length })}
        </button>
      )}
    </div>
  );
}
