import { useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// The agent's system-prompt field. An inline textarea plus a maximize control next
// to the label that opens the same value in a large dialog for comfortable editing.
// Both editors are bound to the same value/onChange, so edits stay in sync. Used in
// both the compact side panel and the full-width layout.
export function AgentInstructionsField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor="agent-instructions" className="text-sm font-medium">
          Instructions
        </label>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="-my-1 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Expand instructions editor"
          title="Expand editor"
        >
          <Maximize2 className="size-3.5" />
        </button>
      </div>
      <Textarea
        id="agent-instructions"
        placeholder="How the agent should behave and any rules to follow"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-24"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="flex h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-none flex-col gap-4 sm:max-w-none"
        >
          <DialogHeader className="flex-row items-center justify-between space-y-0">
            <DialogTitle>Instructions</DialogTitle>
            <DialogClose asChild>
              <Button type="button" size="sm">
                Done
              </Button>
            </DialogClose>
          </DialogHeader>
          <Textarea
            autoFocus
            placeholder="How the agent should behave and any rules to follow"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="min-h-0 flex-1 resize-none border-0 bg-transparent px-0 text-base leading-relaxed shadow-none focus-visible:ring-0"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
