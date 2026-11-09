'use client';

import { Fragment } from 'react';
import { colorDot } from '@/components/common/fields/colorDot';

export interface TemplateItem {
  key: string | number;
  name: string;
  color?: string;
  hint?: string;
}

// What one part of a template holds: in a row, or with `list` one per line beside its
// hint.
export default function ProjectTemplateItems({
  items,
  list = false,
}: {
  items: TemplateItem[];
  list?: boolean;
}) {
  if (list) {
    return (
      <div className="grid grid-cols-[minmax(0,max-content)_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
        {items.map((item) => (
          <Fragment key={item.key}>
            <span className="truncate" dir="auto">
              {item.name}
            </span>
            <span className="truncate text-muted-foreground">{item.hint}</span>
          </Fragment>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
      {items.map((item) => (
        <span key={item.key} className="flex min-w-0 items-center gap-1.5">
          {item.color && colorDot(item.color)}
          <span className="truncate" dir="auto">
            {item.name}
          </span>
          {item.hint && <span className="shrink-0 text-muted-foreground">{item.hint}</span>}
        </span>
      ))}
    </div>
  );
}
