import { useTranslations } from 'next-intl';
import type { ModelPriceRow } from '@/lib/api/endpoints/modelPrices';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCount, formatRate } from '../../utils/format';
import ModelPriceSource from './ModelPriceSource';

// Models with the price their calls are costed at: the workspace's own where it set
// one, the built-in one otherwise. `calls` is shown for the models the workspace uses.
export default function ModelPriceTable({
  rows,
  onEdit,
}: {
  rows: (ModelPriceRow & { calls?: number })[];
  onEdit: (row: ModelPriceRow) => void;
}) {
  const t = useTranslations('teams.workspace.modelPrices');
  const withCalls = rows.some((row) => row.calls != null);
  const head = 'text-xs font-medium text-muted-foreground';

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={head}>{t('columns.model')}</TableHead>
            {withCalls && (
              <TableHead className={`${head} text-end`}>{t('columns.calls')}</TableHead>
            )}
            <TableHead className={`${head} text-end`}>{t('columns.input')}</TableHead>
            <TableHead className={`${head} text-end`}>{t('columns.output')}</TableHead>
            <TableHead className={`${head} text-end`}>{t('columns.cacheRead')}</TableHead>
            <TableHead className={`${head} text-end`}>{t('columns.cacheWrite')}</TableHead>
            <TableHead className={head}>{t('columns.price')}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const price = row.own ?? row.builtIn;
            return (
              <TableRow key={`${row.provider}/${row.model}`}>
                <TableCell className="max-w-72">
                  <div className="truncate font-medium">{row.model}</div>
                  <div className="truncate text-xs text-muted-foreground">{row.provider}</div>
                </TableCell>
                {withCalls && (
                  <TableCell className="text-end tabular-nums">
                    {formatCount(row.calls ?? 0)}
                  </TableCell>
                )}
                <TableCell className="text-end tabular-nums">{formatRate(price?.input)}</TableCell>
                <TableCell className="text-end tabular-nums">{formatRate(price?.output)}</TableCell>
                <TableCell className="text-end tabular-nums">
                  {formatRate(price?.cacheRead)}
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  {formatRate(price?.cacheWrite)}
                </TableCell>
                <TableCell>
                  <ModelPriceSource row={row} />
                </TableCell>
                <TableCell className="text-end">
                  {price ? (
                    <Button size="sm" variant="ghost" onClick={() => onEdit(row)}>
                      {t('edit')}
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => onEdit(row)}>
                      {t('setPrice')}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
