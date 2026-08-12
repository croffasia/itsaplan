import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { initiativePath } from '@/utils/paths';
import { useCreateInitiative } from '@/services/initiatives.service';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// Creates an initiative from a title and optional description, then opens its
// detail page. The remaining fields (owner, priority, target date, labels) are
// set there.
export default function CreateInitiativeDialog({
  projectKey,
  onClose,
}: {
  projectKey: string;
  onClose: () => void;
}) {
  const t = useTranslations('initiatives');
  const tCommon = useTranslations('common');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const create = useCreateInitiative(projectKey);
  const router = useRouter();

  const submit = async () => {
    const name = title.trim();
    if (!name) return;
    const created = await create.mutateAsync({ title: name, description: description.trim() });
    onClose();
    router.push(initiativePath(projectKey, created.id));
  };

  return (
    <Modal title={t('newInitiative')} projectKey={projectKey} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="initiative-title">{t('form.title')}</Label>
          <Input
            id="initiative-title"
            value={title}
            autoFocus
            placeholder={t('form.titlePlaceholder')}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && title.trim() && void submit()}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="initiative-description">{t('form.description')}</Label>
          <Textarea
            id="initiative-description"
            value={description}
            placeholder={t('form.descriptionPlaceholder')}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button disabled={!title.trim() || create.isPending} onClick={() => void submit()}>
            {create.isPending ? t('form.creating') : t('form.create')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
