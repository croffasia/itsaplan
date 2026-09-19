'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { StudioPostInput, StudioTemplate } from '@/lib/api';

export default function StudioNewPostDialog({
  open,
  onOpenChange,
  templates,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: StudioTemplate[];
  saving: boolean;
  onSubmit: (input: StudioPostInput) => void;
}) {
  const [templateId, setTemplateId] = useState('');
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');

  useEffect(() => {
    if (!open) return;
    setTemplateId(templates[0]?.id ?? '');
    setTitle('');
    setTopic('');
  }, [open, templates]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New post</DialogTitle>
          <DialogDescription>
            The title names the post and its folder in the vault. Everything this post produces is
            stored there.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="post-template">Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger id="post-template" className="w-full">
                <SelectValue placeholder="Pick a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="post-title">Title</Label>
            <Input
              id="post-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Spring launch teaser"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="post-topic">What is the post about?</Label>
            <Textarea
              id="post-topic"
              rows={3}
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="We open the new shop in Utrecht on 3 May, with a free tasting all afternoon."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSubmit({ templateId, title: title.trim(), topic: topic.trim() || undefined })
            }
            disabled={saving || !templateId || title.trim().length === 0}
          >
            {saving ? 'Creating…' : 'Create post'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
