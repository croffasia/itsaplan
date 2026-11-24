import type { LucideIcon } from 'lucide-react';
import DocumentToolbarButton from './DocumentToolbarButton';

export type DocumentToolbarAction = {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  run: () => void;
};

export default function DocumentToolbarActions({ actions }: { actions: DocumentToolbarAction[] }) {
  return actions.map((action) => (
    <DocumentToolbarButton
      key={action.label}
      label={action.label}
      active={action.active}
      onClick={action.run}
    >
      <action.icon />
    </DocumentToolbarButton>
  ));
}
