'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import type { MemberRow } from '@/lib/api';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSetMemberDescription } from '@/services/members.service';

// The "Edit" action for a member's project description: a button that opens a
// centered dialog with a textarea. A member edits their own; an owner edits
// anyone's (the API enforces it). Rendered in the member row's actions.
export default function MemberDescriptionDialog({
  projectKey,
  member,
  self,
}: {
  projectKey: string;
  member: MemberRow;
  self: boolean;
}) {
  const setDescription = useSetMemberDescription(projectKey);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(member.description);

  function openDialog() {
    setValue(member.description);
    setOpen(true);
  }

  async function save() {
    try {
      await setDescription.mutateAsync({ userId: member.userId, description: value.trim() });
      setOpen(false);
    } catch {
      // The failed mutation is toasted by the global handler; keep the dialog open.
    }
  }

  const question = self
    ? 'What do you do and what are you responsible for in this project?'
    : 'What does this member do and what are they responsible for in this project?';

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={openDialog}
            aria-label="Edit description"
          >
            <Pencil className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Edit description</TooltipContent>
      </Tooltip>
      <Dialog open={open} onOpenChange={(next) => !next && setOpen(false)}>
        <DialogContent className="inset-0 top-0 left-0 h-screen w-full max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-0 bg-background p-0 sm:max-w-none">
          <div className="flex h-full w-full flex-col items-center justify-center px-6 py-16">
            <div className="flex w-full max-w-2xl flex-col items-center gap-10">
              <DialogTitle className="max-w-[20ch] text-center text-3xl leading-tight font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
                {question}
              </DialogTitle>
              <div className="flex w-full flex-col items-end gap-5">
                <Textarea
                  autoFocus
                  maxLength={500}
                  value={value}
                  placeholder="e.g. Backend engineer, owns the API and integrations"
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void save();
                  }}
                  className="min-h-40 w-full rounded-xl border-0 bg-card p-5 text-base leading-relaxed shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-base"
                />
                <Button
                  size="lg"
                  className="min-w-28"
                  onClick={save}
                  disabled={setDescription.isPending}
                >
                  {setDescription.isPending ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
