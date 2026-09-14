import type { MindCategory, MindFact, MindStatus } from '@/lib/api';
import { CATEGORY_META } from '../utils/mind';
import MindFactCard from './MindFactCard';

export default function MindCategorySection({
  category,
  facts,
  canEdit,
  canDelete,
  onTogglePin,
  onStatus,
  onCategory,
  onForget,
}: {
  category: MindCategory;
  facts: MindFact[];
  canEdit: boolean;
  canDelete: boolean;
  onTogglePin: (fact: MindFact) => void;
  onStatus: (fact: MindFact, status: MindStatus) => void;
  onCategory: (fact: MindFact, category: MindCategory) => void;
  onForget: (fact: MindFact) => void;
}) {
  const meta = CATEGORY_META[category];

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md border">
          <meta.icon className="size-3.5" />
        </span>
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {meta.label}
        </h3>
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground tabular-nums">
          {facts.length} {facts.length === 1 ? 'fact' : 'facts'}
        </span>
      </div>
      <div className="space-y-3">
        {facts.map((fact) => (
          <MindFactCard
            key={fact.id}
            fact={fact}
            canEdit={canEdit}
            canDelete={canDelete}
            onTogglePin={() => onTogglePin(fact)}
            onStatus={(status) => onStatus(fact, status)}
            onCategory={(next) => onCategory(fact, next)}
            onForget={() => onForget(fact)}
          />
        ))}
      </div>
    </section>
  );
}
