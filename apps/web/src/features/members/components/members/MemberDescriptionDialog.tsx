'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { MemberRow } from '@/lib/api';
import Avatar from '@/components/common/Avatar';
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
  const t = useTranslations('members');
  const tCommon = useTranslations('common');
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

  // "Role" is taken by the member's permission role in this same list, so the
  // question asks what the person does instead.
  const question = self ? t('descriptionQuestionSelf') : t('descriptionQuestionOther');
  const displayName = member.name || member.email;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={openDialog}
            aria-label={t('editDescription')}
          >
            <Pencil className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('editDescription')}</TooltipContent>
      </Tooltip>
      <Dialog open={open} onOpenChange={(next) => !next && setOpen(false)}>
        <DialogContent className="inset-0 top-0 left-0 h-screen w-full max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-0 bg-background p-0 sm:max-w-none">
          <div className="flex h-full w-full flex-col items-center justify-center px-6 py-16">
            <div className="flex w-full max-w-2xl flex-col items-center gap-10">
              <div className="flex flex-col items-center gap-5">
                <DialogTitle className="max-w-[32ch] text-center text-2xl leading-tight font-medium tracking-tight text-balance text-foreground sm:text-3xl">
                  {question}
                </DialogTitle>
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={displayName} image={member.image} className="size-9 text-xs" />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{displayName}</span>
                    <span className="truncate text-xs text-muted-foreground">{member.email}</span>
                  </div>
                </div>
              </div>
              <div className="flex w-full flex-col items-end gap-5">
                <Textarea
                  autoFocus
                  maxLength={500}
                  value={value}
                  placeholder={t('descriptionPlaceholder')}
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
                  {setDescription.isPending ? tCommon('saving') : tCommon('save')}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
