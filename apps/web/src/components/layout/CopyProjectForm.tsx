import { KEY_MAX_LENGTH } from '@/utils/projectKey';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import CopyProjectOptions, { type CopyInclude } from '@/components/layout/CopyProjectOptions';

// The copy-a-project form. The fields are few and the sections to carry over are
// many, so everything stacks full width instead of leaving one short column next
// to a tall one.
export default function CopyProjectForm({
  name,
  projectKey,
  description,
  include,
  onNameChange,
  onKeyChange,
  onDescriptionChange,
  onIncludeChange,
}: {
  name: string;
  projectKey: string;
  description: string;
  include: CopyInclude;
  onNameChange: (value: string) => void;
  onKeyChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onIncludeChange: (value: CopyInclude) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input autoFocus value={name} onChange={(e) => onNameChange(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:w-40">
          <Label>Key</Label>
          <Input
            value={projectKey}
            onChange={(e) => onKeyChange(e.target.value)}
            maxLength={KEY_MAX_LENGTH}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          rows={2}
          className="resize-none"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
        />
      </div>
      <CopyProjectOptions value={include} onChange={onIncludeChange} />
    </div>
  );
}
