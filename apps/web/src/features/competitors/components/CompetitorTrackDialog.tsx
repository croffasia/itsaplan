import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CompetitorInput, CompetitorOverview, CompetitorPlatform } from '@/lib/api';
import { PLATFORM_META, PLATFORM_ORDER } from '../utils/competitors';

export default function CompetitorTrackDialog({
  open,
  onOpenChange,
  onSubmit,
  saving,
  providers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CompetitorInput) => void;
  saving: boolean;
  providers: CompetitorOverview['providers'];
}) {
  const [platform, setPlatform] = useState<CompetitorPlatform>('instagram');
  const [handle, setHandle] = useState('');
  const [label, setLabel] = useState('');
  const [tags, setTags] = useState('');

  const provider = providers.find((entry) => entry.platform === platform);

  const submit = () => {
    onSubmit({
      platform,
      handle: handle.trim(),
      label: label.trim() || undefined,
      tags: tags
        .split(/[\s,]+/)
        .map((tag) => tag.replace(/^#/, '').toLowerCase())
        .filter((tag) => tag.length > 0)
        .slice(0, 12),
    });
    setHandle('');
    setLabel('');
    setTags('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Track an account</DialogTitle>
          <DialogDescription>
            Paste a handle or a profile link. You are alerted when it posts, when its profile
            changes, and when its following moves.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
            <div className="space-y-2">
              <Label htmlFor="competitor-platform">Platform</Label>
              <Select
                value={platform}
                onValueChange={(value) => setPlatform(value as CompetitorPlatform)}
              >
                <SelectTrigger id="competitor-platform" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORM_ORDER.map((value) => (
                    <SelectItem key={value} value={value}>
                      {PLATFORM_META[value].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="competitor-handle">Account</Label>
              <Input
                id="competitor-handle"
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
                placeholder="@rivalbrand"
              />
            </div>
          </div>

          {provider && !provider.available && (
            <p className="rounded-md border border-dashed p-2.5 text-xs text-muted-foreground">
              {PLATFORM_META[platform].label} has no credential yet, so this account is saved but
              will not report until one is added under Integrations.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="competitor-label">Label</Label>
              <Input
                id="competitor-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Their main brand account"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="competitor-tags">Tags</Label>
              <Input
                id="competitor-tags"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="direct-rival solar"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={handle.trim().length === 0 || saving} onClick={submit}>
            Track
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
