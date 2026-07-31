import { Button } from '@/components/ui/button';

// The footer of a paged list: loads the next page. The caller renders it only while
// another page exists.
export default function ShowMoreButton({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <div className="mt-4">
      <Button variant="ghost" size="sm" disabled={loading} onClick={onClick}>
        {loading ? 'Loading…' : 'Show more'}
      </Button>
    </div>
  );
}
