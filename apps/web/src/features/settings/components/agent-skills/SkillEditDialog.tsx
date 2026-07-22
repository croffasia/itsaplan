import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { api, type AgentSkill, type SkillPatch } from '@/lib/api';
import { qk } from '@/services/queryKeys';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useSkillsQuery,
  useUpdateSkill,
  useUpdateSkillReference,
  useAddSkillReference,
  useDeleteSkillReference,
} from '@/services/agentSkills.service';
import { SkillFileList, type SkillFileEntry } from './SkillFileList';

// The key used for the SKILL.md file in the explorer and the drafts map. Reference
// files use their own relative path.
const SKILL_MD = 'SKILL.md';

// Fullscreen editor for a skill. The left pane lists the skill's files (SKILL.md
// plus references) and its name/description; the right pane is a raw markdown editor
// for the selected file. Each file's content is loaded on demand from the object
// store and cached; edits are held per file until Save writes them all.
export function SkillEditDialog({
  projectKey,
  skill: initialSkill,
  canEdit,
  onClose,
}: {
  projectKey: string;
  skill: AgentSkill;
  canEdit: boolean;
  onClose: () => void;
}) {
  const skillId = initialSkill.id;
  // Read the live skill from the list so the file explorer reflects add/delete
  // immediately; fall back to the snapshot passed in.
  const skillsQuery = useSkillsQuery(projectKey);
  const skill = skillsQuery.data?.find((s) => s.id === skillId) ?? initialSkill;

  const [name, setName] = useState(skill.name);
  const [description, setDescription] = useState(skill.description);
  const [selected, setSelected] = useState<string>(SKILL_MD);
  // Edited content per file path; a key present here is unsaved.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const update = useUpdateSkill(projectKey);
  const updateRef = useUpdateSkillReference(projectKey);
  const addRef = useAddSkillReference(projectKey);
  const deleteRef = useDeleteSkillReference(projectKey);

  // The selected file's saved content, cached per file by React Query.
  const contentQuery = useQuery({
    queryKey: [...qk.agentSkills(projectKey), skillId, 'file', selected],
    queryFn: () =>
      selected === SKILL_MD
        ? api.getSkillMarkdown(projectKey, skillId).then((r) => r.markdown)
        : api.getSkillReferenceContent(projectKey, skillId, selected).then((r) => r.content),
  });

  const draft = drafts[selected];
  const content = draft ?? contentQuery.data ?? '';
  const loading = draft === undefined && contentQuery.isLoading;

  const files: SkillFileEntry[] = [
    { path: SKILL_MD, label: SKILL_MD, size: null, deletable: false },
    ...skill.files.map((f) => ({ path: f.path, label: f.path, size: f.size, deletable: true })),
  ];

  const dirtyPaths = new Set(Object.keys(drafts));
  const metaDirty = name.trim() !== skill.name || description.trim() !== skill.description;
  const dirty = metaDirty || dirtyPaths.size > 0;

  function edit(value: string) {
    setDrafts((d) => ({ ...d, [selected]: value }));
  }

  async function onAddFile(file: File) {
    const updated = await addRef.mutateAsync({ id: skillId, file });
    const added = updated.files.find((f) => !skill.files.some((s) => s.path === f.path));
    if (added) setSelected(added.path);
  }

  async function onDeleteFile(path: string) {
    await deleteRef.mutateAsync({ id: skillId, path });
    setDrafts((d) => {
      const { [path]: _removed, ...rest } = d;
      return rest;
    });
    if (selected === path) setSelected(SKILL_MD);
  }

  // Persists the metadata and SKILL.md in one call, then each edited reference.
  async function save() {
    setBusy(true);
    try {
      const patch: SkillPatch = {};
      if (name.trim() !== skill.name) patch.name = name.trim();
      if (description.trim() !== skill.description) patch.description = description.trim();
      if (SKILL_MD in drafts) patch.markdown = drafts[SKILL_MD];
      if (Object.keys(patch).length > 0) await update.mutateAsync({ id: skillId, patch });
      for (const [path, value] of Object.entries(drafts)) {
        if (path === SKILL_MD) continue;
        await updateRef.mutateAsync({ id: skillId, path, content: value });
      }
      onClose();
    } catch {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="top-0 left-0 grid h-screen w-screen max-w-none translate-x-0 translate-y-0 grid-rows-[auto_1fr] gap-0 rounded-none border-0 p-0 sm:max-w-none"
      >
        <header className="flex items-center gap-3 border-b border-border/60 px-5 py-3">
          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
            {projectKey}
          </span>
          <span className="shrink-0 text-muted-foreground">›</span>
          <DialogTitle className="min-w-0 flex-1 truncate text-sm font-medium">
            {skill.name}
          </DialogTitle>
          {canEdit && (
            <Button size="sm" onClick={save} disabled={busy || !dirty || name.trim() === ''}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </header>

        <div className="grid min-h-0 grid-cols-[minmax(0,17rem)_1fr]">
          <aside className="flex min-h-0 flex-col gap-5 overflow-y-auto border-r border-border/60 p-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Shown to the agent to decide when to load this skill"
                disabled={!canEdit}
              />
            </div>
            <SkillFileList
              files={files}
              selected={selected}
              dirtyPaths={dirtyPaths}
              canEdit={canEdit}
              onSelect={setSelected}
              onDelete={onDeleteFile}
              onAddFile={onAddFile}
            />
          </aside>

          <section className="grid min-h-0 grid-rows-[auto_1fr]">
            <div className="flex items-center gap-2 border-b border-border/60 px-5 py-2.5">
              <span className="font-mono text-xs text-foreground">{selected}</span>
              {dirtyPaths.has(selected) && (
                <span className="text-[11px] text-muted-foreground">· unsaved</span>
              )}
            </div>
            <textarea
              value={loading ? '' : content}
              onChange={(e) => edit(e.target.value)}
              disabled={!canEdit || loading}
              spellCheck={false}
              placeholder={loading ? 'Loading…' : ''}
              className={cn(
                'h-full w-full resize-none bg-transparent px-5 py-4 focus-visible:ring-ring/40',
                'font-mono text-xs leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-inset',
              )}
            />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
