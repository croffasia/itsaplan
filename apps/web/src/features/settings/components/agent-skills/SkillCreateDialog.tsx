import { useMemo, useState } from 'react';
import { Search, TriangleAlert, X } from 'lucide-react';
import type { GithubSkillCandidate, NewSkillInput } from '@/lib/api';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useCreateSkill, useDiscoverGithubSkills } from '@/services/agentSkills.service';

type Source = 'inline' | 'upload' | 'github';

// Counts non-overlapping occurrences of `needle` in `haystack` (both already
// lowercased by the caller). Used to rank skill search matches by frequency.
function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  for (
    let i = haystack.indexOf(needle);
    i !== -1;
    i = haystack.indexOf(needle, i + needle.length)
  ) {
    count++;
  }
  return count;
}

// Create a skill from one of three sources, chosen by tab: inline markdown, an
// uploaded SKILL.md file (read client-side), or GitHub. name and description are
// optional (the server fills them from the SKILL.md frontmatter). GitHub import is
// two steps: discover the skills at a URL, then pick which ones to import. Each
// picked skill is imported as its own row (SKILL.md plus its markdown references).
export function SkillCreateDialog({
  projectKey,
  onClose,
}: {
  projectKey: string;
  onClose: () => void;
}) {
  const [source, setSource] = useState<Source>('inline');
  const [markdown, setMarkdown] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [name, setName] = useState('');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);

  // GitHub discover-then-pick state.
  const [candidates, setCandidates] = useState<GithubSkillCandidate[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Case-insensitive filter over the discovered skills, matched on name and description.
  const [query, setQuery] = useState('');

  // Filtered and ranked by relevance: a name match outranks a description-only
  // match, then more occurrences (name first, then description) rank higher. Array
  // sort is stable, so equally scored skills keep their discovered order.
  const filteredCandidates = useMemo(() => {
    if (!candidates) return [];
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates
      .map((c) => ({
        c,
        nameHits: countOccurrences(c.name.toLowerCase(), q),
        descHits: countOccurrences((c.description ?? '').toLowerCase(), q),
      }))
      .filter((r) => r.nameHits > 0 || r.descHits > 0)
      .sort((a, b) => {
        const aInName = a.nameHits > 0 ? 1 : 0;
        const bInName = b.nameHits > 0 ? 1 : 0;
        if (aInName !== bInName) return bInName - aInName;
        if (a.nameHits !== b.nameHits) return b.nameHits - a.nameHits;
        return b.descHits - a.descHits;
      })
      .map((r) => r.c);
  }, [candidates, query]);

  const create = useCreateSkill(projectKey);
  const discover = useDiscoverGithubSkills(projectKey);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setMarkdown(await file.text());
  }

  async function runDiscover() {
    setBusy(true);
    try {
      const found = await discover.mutateAsync(sourceUrl.trim());
      setCandidates(found);
      setSelected(new Set(found.map((s) => s.url)));
      setQuery('');
    } catch {
      // Errors surface through the global toast.
    } finally {
      setBusy(false);
    }
  }

  function toggle(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  // Whether every currently visible (filtered) skill is selected; drives the
  // "Select all" state so it reflects the current filter rather than the full list.
  const allFilteredSelected =
    filteredCandidates.length > 0 && filteredCandidates.every((c) => selected.has(c.url));

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filteredCandidates.forEach((c) => next.delete(c.url));
      else filteredCandidates.forEach((c) => next.add(c.url));
      return next;
    });
  }

  // Imports the picked GitHub skills, one create call each. Individual failures
  // surface through the global toast; the dialog closes if at least one succeeds.
  async function importSelected() {
    const urls = candidates!.filter((c) => selected.has(c.url)).map((c) => c.url);
    setBusy(true);
    const results = await Promise.allSettled(
      urls.map((url) => create.mutateAsync({ source: 'github', sourceUrl: url })),
    );
    setBusy(false);
    if (results.some((r) => r.status === 'fulfilled')) onClose();
  }

  async function submitInline() {
    setBusy(true);
    try {
      const input: NewSkillInput = { source, name: name.trim() || null, markdown };
      await create.mutateAsync(input);
      onClose();
    } catch {
      setBusy(false);
    }
  }

  // Shared tail for the inline and upload tabs: an optional name and the create
  // buttons (both submit the same markdown).
  const nameAndCreate = (
    <>
      <div className="space-y-1.5">
        <Label>Name (optional)</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Defaults to the SKILL.md frontmatter name"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={submitInline} disabled={busy || markdown.trim() === ''}>
          Create skill
        </Button>
      </div>
    </>
  );

  // The GitHub selection step replaces the rest of the form once skills are found.
  if (source === 'github' && candidates) {
    return (
      <Modal title="Import skills from GitHub" projectKey={projectKey} onClose={onClose} wide>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {query.trim() ? (
                <>
                  {filteredCandidates.length} of {candidates.length} skill
                  {candidates.length === 1 ? '' : 's'} match
                </>
              ) : (
                <>
                  Found {candidates.length} skill{candidates.length === 1 ? '' : 's'}. Pick which to
                  import.
                </>
              )}
            </p>
            {filteredCandidates.length > 1 && (
              <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={allFilteredSelected} onCheckedChange={toggleAllFiltered} />
                Select all
              </label>
            )}
          </div>

          {candidates.length > 5 && (
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or description"
                className="pr-9 pl-9"
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute top-1/2 right-3 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          )}

          <div className="max-h-80 space-y-1 overflow-y-auto">
            {filteredCandidates.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No skills match &ldquo;{query.trim()}&rdquo;.
              </p>
            ) : (
              filteredCandidates.map((c) => (
                <label
                  key={c.url}
                  className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted/50"
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={selected.has(c.url)}
                    onCheckedChange={() => toggle(c.url)}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{c.name}</div>
                    {c.description && (
                      <div className="line-clamp-2 text-xs text-muted-foreground">
                        {c.description}
                      </div>
                    )}
                    {c.subpath && (
                      <div className="text-xs text-muted-foreground/70">{c.subpath}</div>
                    )}
                  </div>
                </label>
              ))
            )}
          </div>
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setCandidates(null)} disabled={busy}>
              Back
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={importSelected} disabled={busy || selected.size === 0}>
                Import {selected.size > 0 ? selected.size : ''} skill
                {selected.size === 1 ? '' : 's'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="New skill" projectKey={projectKey} onClose={onClose} wide>
      <Tabs value={source} onValueChange={(v) => setSource(v as Source)}>
        <TabsList variant="line">
          <TabsTrigger value="inline">Write markdown</TabsTrigger>
          <TabsTrigger value="upload">Upload a file</TabsTrigger>
          <TabsTrigger value="github">Import from GitHub</TabsTrigger>
        </TabsList>

        <TabsContent value="inline" className="mt-2 space-y-4">
          <div className="space-y-1.5">
            <Label>SKILL.md</Label>
            <Textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              rows={10}
              className="font-mono text-xs"
              placeholder={
                '---\nname: My skill\ndescription: What it does and when to use it\n---\n\nInstructions…'
              }
            />
          </div>
          {nameAndCreate}
        </TabsContent>

        <TabsContent value="upload" className="mt-2 space-y-4">
          <div className="space-y-1.5">
            <Label>SKILL.md file</Label>
            <Input
              type="file"
              accept=".md,.markdown,.txt,text/markdown,text/plain"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            {fileName && <p className="text-xs text-muted-foreground">Loaded {fileName}</p>}
          </div>
          {nameAndCreate}
        </TabsContent>

        <TabsContent value="github" className="mt-2 space-y-4">
          <div className="flex gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
            <TriangleAlert className="mt-px size-4 shrink-0" />
            <div className="space-y-1.5 text-xs leading-relaxed">
              <p className="font-medium">Import only skills you trust</p>
              <ul className="list-disc space-y-0.5 pl-4 text-amber-700/90 dark:text-amber-300/90">
                <li>A skill becomes instructions your agents follow. Review the source first.</li>
                <li>
                  Only SKILL.md and its markdown references are imported. Scripts are skipped.
                </li>
              </ul>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>GitHub URL</Label>
            <Input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://github.com/owner/repo or a skill folder"
            />
            <p className="text-xs text-muted-foreground">A repository, a folder, or a SKILL.md.</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={runDiscover} disabled={busy || sourceUrl.trim() === ''}>
              Find skills
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </Modal>
  );
}
