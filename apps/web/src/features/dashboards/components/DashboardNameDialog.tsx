import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

// A small name prompt used for both create and rename.
export default function DashboardNameDialog({
  open,
  title,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initial: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const t = useTranslations('dashboards');
  const tCommon = useTranslations('common');
  const [name, setName] = useState(initial);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = name.trim();
            if (trimmed) onSubmit(trimmed);
          }}
        >
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('namePlaceholder')}
          />
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {tCommon('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
