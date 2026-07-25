import RequireFeature from '@/components/common/permissions/RequireFeature';
import NotesPage from '@/features/notes/NotesPage';

export default function Page() {
  return (
    <RequireFeature feature="notes">
      <NotesPage />
    </RequireFeature>
  );
}
