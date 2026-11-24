import { useTranslations } from 'next-intl';
import {
  copyOptionsOf,
  isIncluded,
  toggleInclude,
  type CopyGroup,
  type CopyInclude,
} from '@/utils/copyOptions';
import { Checkbox } from '@/components/ui/checkbox';

const GRID_COLUMNS: Record<number, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
};

// Grid of copy options, grouped by settings section. Selecting a dependent option
// pulls in the entities it references; clearing a required one clears its dependents.
export default function CopyProjectOptions({
  columns,
  value,
  onChange,
}: {
  columns: CopyGroup[][];
  value: CopyInclude;
  onChange: (next: CopyInclude) => void;
}) {
  const t = useTranslations('newProject');
  const options = copyOptionsOf(columns);
  const total = options.length;
  const selectedCount = options.filter((option) => isIncluded(value, option.key)).length;
  const allOn = selectedCount === total;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">
          {t('copyConfiguration')}{' '}
          <span className="text-xs font-normal text-muted-foreground tabular-nums">
            {selectedCount}/{total}
          </span>
        </span>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() =>
            onChange(Object.fromEntries(options.map((option) => [option.key, !allOn])))
          }
        >
          {t(allOn ? 'clearAll' : 'selectAll')}
        </button>
      </div>
      <div className={`grid grid-cols-2 gap-x-4 ${GRID_COLUMNS[Math.min(columns.length, 4)]}`}>
        {columns.map((column, i) => (
          <div key={i} className="space-y-3">
            {column.map((group) => (
              <div key={group.key} className="space-y-1">
                <p className="text-xs text-muted-foreground">{group.title}</p>
                {group.options.map((option) => (
                  <label
                    key={option.key}
                    className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
                  >
                    <Checkbox
                      checked={isIncluded(value, option.key)}
                      onCheckedChange={(c) =>
                        onChange(toggleInclude(columns, value, option.key, c === true))
                      }
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
