import { useTranslations } from 'next-intl';
import { KEY_MAX_LENGTH } from '@/utils/projectKey';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function NewProjectFields({
  name,
  projectKey,
  description,
  onNameChange,
  onKeyChange,
  onDescriptionChange,
}: {
  name: string;
  projectKey: string;
  description: string;
  onNameChange: (value: string) => void;
  onKeyChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}) {
  const t = useTranslations('newProject');

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-1.5">
        <Label>{t('name')}</Label>
        <Input autoFocus value={name} onChange={(e) => onNameChange(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>{t('key')}</Label>
        <Input
          value={projectKey}
          onChange={(e) => onKeyChange(e.target.value)}
          maxLength={KEY_MAX_LENGTH}
        />
      </div>
      <div className="flex flex-1 flex-col space-y-1.5">
        <Label>{t('description')}</Label>
        <Textarea
          rows={2}
          className="min-h-20 flex-1 resize-none"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
        />
      </div>
    </div>
  );
}
