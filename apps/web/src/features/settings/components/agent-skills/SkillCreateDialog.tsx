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
import { useTranslations } from 'next-intl';

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
  const t = useTranslations('settings.skills');
  const tCommon = useTranslations('common');
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
        <Label>{t('name')}</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('namePlaceholder')}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          {tCommon('cancel')}
        </Button>
        <Button onClick={submitInline} disabled={busy || markdown.trim() === ''}>
          {t('create')}
        </Button>
      </div>
    </>
  );

  // The GitHub selection step replaces the rest of the form once skills are found.
  if (source === 'github' && candidates) {
    return (
      <Modal title={t('importTitle')} projectKey={projectKey} onClose={onClose} wide>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {query.trim()
                ? t('matchCount', { shown: filteredCandidates.length, total: candidates.length })
                : t('foundCount', { count: candidates.length })}
            </p>
            {filteredCandidates.length > 1 && (
              <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={allFilteredSelected} onCheckedChange={toggleAllFiltered} />
                {t('selectAll')}
              </label>
            )}
          </div>

          {candidates.length > 5 && (
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="ps-9 pe-9"
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute end-3 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={tCommon('clearSearch')}
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          )}

          <div className="max-h-80 space-y-1 overflow-y-auto">
            {filteredCandidates.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {t('noMatches', { query: query.trim() })}
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
              {tCommon('back')}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={busy}>
                {tCommon('cancel')}
              </Button>
              <Button onClick={importSelected} disabled={busy || selected.size === 0}>
                {t('importCount', { count: selected.size })}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={t('newSkill')} projectKey={projectKey} onClose={onClose} wide>
      <Tabs value={source} onValueChange={(v) => setSource(v as Source)}>
        <TabsList variant="line">
          <TabsTrigger value="inline">{t('tabInline')}</TabsTrigger>
          <TabsTrigger value="upload">{t('tabUpload')}</TabsTrigger>
          <TabsTrigger value="github">{t('tabGithub')}</TabsTrigger>
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
            <Label>{t('skillFile')}</Label>
            <Input
              type="file"
              accept=".md,.markdown,.txt,text/markdown,text/plain"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            {fileName && (
              <p className="text-xs text-muted-foreground">{t('loaded', { file: fileName })}</p>
            )}
          </div>
          {nameAndCreate}
        </TabsContent>

        <TabsContent value="github" className="mt-2 space-y-4">
          <div className="flex gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
            <TriangleAlert className="mt-px size-4 shrink-0" />
            <div className="space-y-1.5 text-xs leading-relaxed">
              <p className="font-medium">{t('trustWarning')}</p>
              <ul className="list-disc space-y-0.5 ps-4 text-amber-700/90 dark:text-amber-300/90">
                <li>{t('trustWarning1')}</li>
                <li>{t('trustWarning2')}</li>
              </ul>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t('githubUrl')}</Label>
            <Input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder={t('githubUrlPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">{t('githubUrlHint')}</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={runDiscover} disabled={busy || sourceUrl.trim() === ''}>
              {t('findSkills')}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </Modal>
  );
}
