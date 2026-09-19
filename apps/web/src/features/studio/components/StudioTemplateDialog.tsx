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
import type {
  IntegrationCredential,
  StudioAspect,
  StudioLayout,
  StudioModels,
  StudioTemplate,
  StudioTemplateInput,
} from '@/lib/api';
import { ASPECT_OPTIONS, DEFAULT_TEMPLATE, FONT_OPTIONS, LAYOUT_OPTIONS } from '../utils/studio';
import StudioTemplateColors from './StudioTemplateColors';

// The design a post is built on. Everything here is read by the drawing code, so
// two posts on one template differ only in their text and photo.
export default function StudioTemplateDialog({
  open,
  onOpenChange,
  template,
  credentials,
  models,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: StudioTemplate | null;
  credentials: IntegrationCredential[];
  models: StudioModels | undefined;
  saving: boolean;
  onSubmit: (input: StudioTemplateInput) => void;
}) {
  const [form, setForm] = useState<StudioTemplateInput>(DEFAULT_TEMPLATE);

  useEffect(() => {
    if (!open) return;
    setForm(template ? { ...template } : DEFAULT_TEMPLATE);
  }, [open, template]);

  const set = <K extends keyof StudioTemplateInput>(key: K, value: StudioTemplateInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit template' : 'New template'}</DialogTitle>
          <DialogDescription>
            The layout is fixed in code. These values set its colours, its font and the style every
            generated photo is asked for.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
              placeholder="Brand announcement"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="template-layout">Layout</Label>
              <Select
                value={form.layout}
                onValueChange={(value) => set('layout', value as StudioLayout)}
              >
                <SelectTrigger id="template-layout" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LAYOUT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {LAYOUT_OPTIONS.find((option) => option.value === form.layout)?.description}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-aspect">Size</Label>
              <Select
                value={form.aspect}
                onValueChange={(value) => set('aspect', value as StudioAspect)}
              >
                <SelectTrigger id="template-aspect" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASPECT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-font">Font</Label>
              <Select value={form.fontFamily} onValueChange={(value) => set('fontFamily', value)}>
                <SelectTrigger id="template-font" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((font) => (
                    <SelectItem key={font} value={font}>
                      {font}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <StudioTemplateColors
            backgroundColor={form.backgroundColor}
            textColor={form.textColor}
            accentColor={form.accentColor}
            onChange={set}
          />

          <div className="space-y-2">
            <Label htmlFor="template-style">Style prompt</Label>
            <Textarea
              id="template-style"
              rows={3}
              value={form.stylePrompt}
              onChange={(event) => set('stylePrompt', event.target.value)}
              placeholder="Editorial photography, warm daylight, muted greens, shallow depth of field, no text in the image."
            />
            <p className="text-xs text-muted-foreground">
              Sent ahead of every image prompt of a post on this template, so the photos keep one
              look.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="template-credential">OpenRouter key</Label>
              <Select
                value={form.credentialId == null ? 'none' : String(form.credentialId)}
                onValueChange={(value) =>
                  set('credentialId', value === 'none' ? null : Number(value))
                }
              >
                <SelectTrigger id="template-credential" className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {credentials.map((credential) => (
                    <SelectItem key={credential.id} value={String(credential.id)}>
                      {credential.label ?? `Credential ${credential.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {credentials.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Add an OpenRouter key under AI Team → Configure → Integrations first.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-image-model">Image model</Label>
              <Input
                id="template-image-model"
                list="studio-image-models"
                value={form.imageModel}
                onChange={(event) => set('imageModel', event.target.value)}
              />
              <datalist id="studio-image-models">
                {(models?.image ?? []).map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-text-model">Text model</Label>
              <Input
                id="template-text-model"
                list="studio-text-models"
                value={form.textModel}
                onChange={(event) => set('textModel', event.target.value)}
                placeholder="Leave empty to write the text yourself"
              />
              <datalist id="studio-text-models">
                {(models?.text ?? []).map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </datalist>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit({ ...form, name: form.name.trim() })}
            disabled={
              saving || form.name.trim().length === 0 || form.imageModel.trim().length === 0
            }
          >
            {saving ? 'Saving…' : template ? 'Save template' : 'Create template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
