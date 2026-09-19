'use client';

import { useEffect, useState } from 'react';
import { Plus, Settings2 } from 'lucide-react';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useCredentialsQuery } from '@/services/integrations.service';
import SectionPageView from '@/components/common/page/SectionPageView';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { StudioTemplate } from '@/lib/api';
import StudioComposer from './components/StudioComposer';
import StudioNewPostDialog from './components/StudioNewPostDialog';
import StudioPostList from './components/StudioPostList';
import StudioTemplateDialog from './components/StudioTemplateDialog';
import {
  useCreateStudioPost,
  useCreateStudioTemplate,
  useStudioModelsQuery,
  useStudioPostsQuery,
  useStudioTemplatesQuery,
  useUpdateStudioTemplate,
} from './services/studio.service';

export default function StudioPage() {
  const { project } = useShell();
  const { can } = usePermissions();
  const projectKey = project?.project.key ?? '';

  const templatesQuery = useStudioTemplatesQuery(projectKey);
  const postsQuery = useStudioPostsQuery(projectKey);
  const modelsQuery = useStudioModelsQuery(projectKey);
  const credentialsQuery = useCredentialsQuery(projectKey || null);
  const createTemplate = useCreateStudioTemplate(projectKey);
  const updateTemplate = useUpdateStudioTemplate(projectKey);
  const createPost = useCreateStudioPost(projectKey);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [templateDialog, setTemplateDialog] = useState<{
    open: boolean;
    template: StudioTemplate | null;
  }>({ open: false, template: null });

  const posts = postsQuery.data ?? [];
  const templates = templatesQuery.data ?? [];
  const selected = posts.find((post) => post.id === selectedId) ?? posts[0] ?? null;
  const selectedTemplate = templates.find((template) => template.id === selected?.templateId);
  const openRouterKeys = (credentialsQuery.data ?? []).filter(
    (credential) => credential.integrationKey === 'openrouter',
  );
  const canEdit = can('studio', 'edit');

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  if (!project || templatesQuery.isLoading || postsQuery.isLoading) {
    return <Skeleton className="m-6 flex-1" />;
  }
  if (!can('studio', 'read')) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        You do not have access to Studio.
      </div>
    );
  }

  return (
    <SectionPageView
      title="Studio"
      description="Build posts on a fixed template, so every post comes out with the same design. Each post keeps its own folder in the vault."
      actions={
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTemplateDialog({ open: true, template: null })}
            disabled={!can('studio', 'create')}
          >
            <Settings2 className="size-4" />
            New template
          </Button>
          <Button
            size="sm"
            onClick={() => setPostDialogOpen(true)}
            disabled={!can('studio', 'create') || templates.length === 0}
          >
            <Plus className="size-4" />
            New post
          </Button>
        </div>
      }
      wide
    >
      {templates.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          Create a template first. It holds the layout, the colours, the font and the style every
          generated photo is asked for, and it needs an OpenRouter key from AI Team → Configure →
          Integrations.
        </p>
      ) : (
        <div className="grid gap-6 pb-8 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="space-y-4">
            <StudioPostList
              posts={posts}
              selectedId={selected?.id ?? null}
              onSelect={setSelectedId}
            />
            <div className="space-y-1.5 border-t pt-4">
              <p className="text-xs font-medium text-muted-foreground">Templates</p>
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className="block w-full truncate rounded-md px-2 py-1 text-left text-sm hover:bg-accent"
                  onClick={() => setTemplateDialog({ open: true, template })}
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>

          {selected && selectedTemplate ? (
            <StudioComposer
              projectKey={projectKey}
              post={selected}
              template={selectedTemplate}
              canEdit={canEdit}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Create a post to start writing and generating.
            </p>
          )}
        </div>
      )}

      <StudioNewPostDialog
        open={postDialogOpen}
        onOpenChange={setPostDialogOpen}
        templates={templates}
        saving={createPost.isPending}
        onSubmit={(input) =>
          createPost.mutate(input, {
            onSuccess: (post) => {
              setSelectedId(post.id);
              setPostDialogOpen(false);
            },
          })
        }
      />

      <StudioTemplateDialog
        open={templateDialog.open}
        onOpenChange={(open) => setTemplateDialog((current) => ({ ...current, open }))}
        template={templateDialog.template}
        credentials={openRouterKeys}
        models={modelsQuery.data}
        saving={createTemplate.isPending || updateTemplate.isPending}
        onSubmit={(input) => {
          const existing = templateDialog.template;
          const done = { onSuccess: () => setTemplateDialog({ open: false, template: null }) };
          if (existing) updateTemplate.mutate({ templateId: existing.id, patch: input }, done);
          else createTemplate.mutate(input, done);
        }}
      />
    </SectionPageView>
  );
}
