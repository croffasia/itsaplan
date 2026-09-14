import { EmptyState } from '@/components/common/page/EmptyState';
import type { MindCategory, MindFact, MindStatus } from '@/lib/api';
import { groupByCategory } from '../utils/mind';
import MindCategorySection from './MindCategorySection';

export default function MindFactList({
  facts,
  hasAnyFact,
  canEdit,
  canDelete,
  onTogglePin,
  onStatus,
  onCategory,
  onForget,
}: {
  facts: MindFact[];
  hasAnyFact: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onTogglePin: (fact: MindFact) => void;
  onStatus: (fact: MindFact, status: MindStatus) => void;
  onCategory: (fact: MindFact, category: MindCategory) => void;
  onForget: (fact: MindFact) => void;
}) {
  const groups = groupByCategory(facts);

  if (groups.length === 0) {
    return (
      <EmptyState
        title={hasAnyFact ? 'Nothing matches' : 'The memory is empty'}
        description={
          hasAnyFact
            ? 'Clear the filter or ask the memory something else.'
            : 'Remember a fact, or capture a thought in Braindump — every capture lands here as a daily note.'
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <MindCategorySection
          key={group.category}
          category={group.category}
          facts={group.facts}
          canEdit={canEdit}
          canDelete={canDelete}
          onTogglePin={onTogglePin}
          onStatus={onStatus}
          onCategory={onCategory}
          onForget={onForget}
        />
      ))}
    </div>
  );
}
