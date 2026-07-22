import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { GeneralForm } from '../../hooks/useGeneralForm';

// The key is shown read-only: it prefixes every issue and cannot change. Only an
// owner may edit; others see the values read-only.
export default function SettingsGeneral({ form }: { form: GeneralForm }) {
  return (
    <section className="flex max-w-lg flex-col gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="project-key">Key</Label>
        <Input id="project-key" value={form.key} disabled readOnly />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="project-name">Name</Label>
        <Input
          id="project-name"
          value={form.name}
          onChange={(e) => form.setName(e.target.value)}
          disabled={!form.editable}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="project-description">Description</Label>
        <Textarea
          id="project-description"
          rows={3}
          value={form.description}
          onChange={(e) => form.setDescription(e.target.value)}
          disabled={!form.editable}
        />
      </div>
    </section>
  );
}
