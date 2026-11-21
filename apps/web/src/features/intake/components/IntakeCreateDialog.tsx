'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CreateIntakeInput } from '@/lib/api/endpoints/intake';

export default function IntakeCreateDialog({
  open,
  onOpenChange,
  onCreate,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: CreateIntakeInput) => Promise<unknown>;
  pending: boolean;
}) {
  const t = useTranslations('intake');
  const tCommon = useTranslations('common');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState('app');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onCreate({
      title: title.trim(),
      description: description.trim() || undefined,
      source: source.trim() || 'app',
    });
    toast.success(t('toast.created'));
    setTitle('');
    setDescription('');
    setSource('app');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('newRequest')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="intake-title">{t('fields.title')}</Label>
            <Input
              id="intake-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('fields.titlePlaceholder')}
              required
              dir="auto"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="intake-description">{t('fields.description')}</Label>
            <Textarea
              id="intake-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('fields.descriptionPlaceholder')}
              rows={4}
              dir="auto"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="intake-source">{t('fields.source')}</Label>
            <Input
              id="intake-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              maxLength={64}
              dir="ltr"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={pending || !title.trim()}>
              {t('actions.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
