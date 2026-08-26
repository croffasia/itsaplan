'use client';

import type { ImportField } from './useImportDraft';

// The mapped columns of the table head, each with the field it feeds, then the
// first rows so the reviewer sees real content before confirming.
export function AgentChatImportPreview({
  headers,
  rows,
  mapping,
}: {
  headers: string[];
  rows: string[][];
  mapping: Partial<Record<ImportField, string>>;
}) {
  const shown = headers.map((header) => ({
    header,
    field: (Object.entries(mapping).find(
      ([, column]) => column?.toLowerCase() === header.toLowerCase(),
    )?.[0] ?? null) as ImportField | null,
  }));

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" dir="auto">
        <thead>
          <tr>
            {shown.map(({ header, field }) => (
              <th key={header} className="border-b px-2 py-1.5 text-start font-medium">
                {header}
                {field && (
                  <span className="ms-1 rounded bg-muted px-1 py-0.5 align-middle text-[10px] tracking-wide text-muted-foreground uppercase">
                    {field}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {shown.map(({ header }, cellIndex) => (
                <td key={header} className="border-b px-2 py-1.5 align-top">
                  {row[cellIndex]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
