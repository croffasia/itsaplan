import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/common/page/EmptyState';
import type { Competitor } from '@/lib/api';
import CompetitorRow from './CompetitorRow';

export default function CompetitorList({
  items,
  hasAny,
  canEdit,
  canDelete,
  checkingId,
  onCheck,
  onToggleActive,
  onUntrack,
}: {
  items: Competitor[];
  hasAny: boolean;
  canEdit: boolean;
  canDelete: boolean;
  checkingId: number | null;
  onCheck: (item: Competitor) => void;
  onToggleActive: (item: Competitor) => void;
  onUntrack: (item: Competitor) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title={hasAny ? 'No accounts match' : 'Nothing is being watched'}
        description={
          hasAny
            ? 'Clear the filter or search for another handle.'
            : 'Track a rival account and you are told when it posts or changes.'
        }
      />
    );
  }

  return (
    <Card className="gap-0 py-0 shadow-none">
      <CardContent className="p-0">
        {items.map((item) => (
          <CompetitorRow
            key={item.id}
            item={item}
            canEdit={canEdit}
            canDelete={canDelete}
            checking={checkingId === item.id}
            onCheck={() => onCheck(item)}
            onToggleActive={() => onToggleActive(item)}
            onUntrack={() => onUntrack(item)}
          />
        ))}
      </CardContent>
    </Card>
  );
}
