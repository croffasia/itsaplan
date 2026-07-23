import { useMemo } from 'react';
import { type WorkItemsViewProps } from '@/utils/project';
import { SelectionProvider } from '../../context/useSelection';
import FlatBoard from './FlatBoard';
import SwimlaneBoard from './SwimlaneBoard';
import { BulkActionBar } from './BulkActionBar';

// The project has two layouts: a flat set of columns, or — when a sub-group
// (swimlane) field is set — the same columns split into horizontal swimlanes.
// Both share one multi-select: the provider holds the selection and the bulk-action
// bar acts on it. `validIds` are the issues currently on the board, so a selected
// issue that leaves (deleted, archived, filtered out) drops from the selection.
export default function KanbanBoard(props: WorkItemsViewProps) {
  const validIds = useMemo(
    () => new Set(props.project.issues.map((i) => i.id)),
    [props.project.issues],
  );

  return (
    <SelectionProvider validIds={validIds}>
      {props.settings.subgroup === 'none' ? <FlatBoard {...props} /> : <SwimlaneBoard {...props} />}
      {!props.readOnly && <BulkActionBar project={props.project} />}
    </SelectionProvider>
  );
}
