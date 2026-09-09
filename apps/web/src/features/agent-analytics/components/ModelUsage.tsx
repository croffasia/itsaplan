import { useTranslations } from 'next-intl';
import type { AgentAnalytics } from '@/lib/api/endpoints/agentAnalytics';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Panel from './Panel';
import PanelEmpty from './PanelEmpty';
import { formatCost, formatCount } from '../utils/format';

// The models the window's calls ran on, with what each read, wrote and cost. A model
// the price table does not name shows its tokens and no amount.
export default function ModelUsage({ data }: { data: AgentAnalytics }) {
  const t = useTranslations('agentAnalytics');
  return (
    <Panel
      title={t('models.title')}
      description={t('models.description')}
      value={formatCost(data.totals.cost)}
      valueLabel={t('models.totalCost')}
    >
      {data.models.length === 0 ? (
        <PanelEmpty label={t('models.empty')} />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('models.model')}</TableHead>
                <TableHead className="text-end">{t('models.input')}</TableHead>
                <TableHead className="text-end">{t('models.output')}</TableHead>
                <TableHead className="text-end">{t('models.cost')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.models.map((row) => (
                <TableRow key={`${row.provider}/${row.model}`}>
                  <TableCell className="max-w-[220px]">
                    <span className="block truncate font-medium">{row.model}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {row.provider}
                    </span>
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatCount(row.inputTokens)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatCount(row.outputTokens)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{formatCost(row.cost)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  );
}
