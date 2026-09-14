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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MindCategory, MindFactInput } from '@/lib/api';
import { CATEGORY_META, CATEGORY_ORDER } from '../utils/mind';

// A fact written by hand goes in trusted and verified-by-a-person is a separate
// step, so it starts higher than a capture but not at certainty.
const DEFAULT_CONFIDENCE = 70;

export default function MindRememberDialog({
  open,
  onOpenChange,
  onSubmit,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: MindFactInput) => void;
  saving: boolean;
}) {
  const [category, setCategory] = useState<MindCategory>('goals');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [pinned, setPinned] = useState(false);

  const submit = () => {
    onSubmit({
      category,
      title: title.trim(),
      body: body.trim(),
      tags: tags
        .split(/[\s,]+/)
        .map((tag) => tag.replace(/^#/, '').toLowerCase())
        .filter((tag) => tag.length > 0)
        .slice(0, 12),
      confidence: DEFAULT_CONFIDENCE,
      pinned,
    });
    setTitle('');
    setBody('');
    setTags('');
    setPinned(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remember this</DialogTitle>
          <DialogDescription>
            One statement the operation should act on. Every agent reads these before it works.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mind-title">The fact</Label>
            <Input
              id="mind-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Q2 goal is a 22% close rate on warm leads"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mind-body">Detail</Label>
            <Textarea
              id="mind-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Why it holds, where it is tracked, who owns it."
              className="min-h-24"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mind-category">Category</Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as MindCategory)}
              >
                <SelectTrigger id="mind-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_ORDER.map((value) => (
                    <SelectItem key={value} value={value}>
                      {CATEGORY_META[value].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mind-tags">Tags</Label>
              <Input
                id="mind-tags"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="sales weekly"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="mind-pinned">Read first</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Pinned facts lead every recall, matched or not.
              </p>
            </div>
            <Switch id="mind-pinned" checked={pinned} onCheckedChange={setPinned} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={title.trim().length === 0 || saving} onClick={submit}>
            Remember
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
