import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { DashboardEditor } from '../hooks/useDashboardEditor';

// The layout buttons beside the dashboard tabs. In edit mode: the add panel toggle,
// then Discard and Save while the layout has unsaved changes, or Done.
export default function DashboardLayoutActions({
  editor,
  editing,
  panelOpen,
  onEdit,
  onTogglePanel,
  onDone,
}: {
  editor: DashboardEditor;
  editing: boolean;
  panelOpen: boolean;
  onEdit: () => void;
  onTogglePanel: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('dashboards');
  const tCommon = useTranslations('common');

  if (!editing) {
    return (
      <Button variant="ghost" size="sm" onClick={onEdit}>
        {t('editLayout')}
      </Button>
    );
  }

  function saveLabel() {
    if (editor.saving) return tCommon('saving');
    return editor.isVirtual ? t('saveDashboard') : t('saveChanges');
  }

  return (
    <>
      <Button
        variant={panelOpen ? 'secondary' : 'outline'}
        size="sm"
        aria-expanded={panelOpen}
        onClick={onTogglePanel}
      >
        <Plus className="size-4" /> {t('addWidget')}
      </Button>
      {editor.dirty ? (
        <>
          <Button
            variant="ghost"
            size="sm"
            disabled={editor.saving}
            onClick={() => editor.discard()}
          >
            {t('discard')}
          </Button>
          <Button size="sm" disabled={editor.saving} onClick={() => void editor.save()}>
            {saveLabel()}
          </Button>
        </>
      ) : (
        <Button variant="secondary" size="sm" onClick={onDone}>
          {tCommon('done')}
        </Button>
      )}
    </>
  );
}
