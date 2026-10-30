import { Fragment } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Column } from '@/lib/api/endpoints/columns';
import { colorDot } from '@/components/common/fields/colorDot';

// The states of a template in board order, the canceled ones set apart after the flow.
export default function ProjectTemplateStates({ columns }: { columns: Column[] }) {
  const flow = columns.filter((column) => column.stateType !== 'canceled');
  const canceled = columns.filter((column) => column.stateType === 'canceled');

  const state = (column: Column) => (
    <span className="flex min-w-0 items-center gap-1.5">
      {colorDot(column.color)}
      <span className="truncate" dir="auto">
        {column.name}
      </span>
    </span>
  );

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
      {flow.map((column, i) => (
        <Fragment key={column.id}>
          {i > 0 && (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground rtl:rotate-180" />
          )}
          {state(column)}
        </Fragment>
      ))}
      {flow.length > 0 && canceled.length > 0 && (
        <span className="px-1 text-muted-foreground">·</span>
      )}
      {canceled.map((column) => (
        <Fragment key={column.id}>{state(column)}</Fragment>
      ))}
    </div>
  );
}
