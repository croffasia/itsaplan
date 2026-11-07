'use client';

import { AtSign, BookOpen, ExternalLink, MoreHorizontal, Unlink, UserPen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { TemplatePublisher } from '@/lib/api/endpoints/project-templates';
import { TEMPLATE_GALLERY_RULES_URL } from '@/utils/app';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// The gallery account of the workspace: the address it publishes under, its author, the
// rules, and the way to link another address or none.
export default function WorkspaceTemplatePublisherMenu({
  publisher,
  onChangeAuthor,
  onChangeEmail,
  onUnlink,
}: {
  publisher: TemplatePublisher;
  onChangeAuthor: () => void;
  onChangeEmail: () => void;
  onUnlink: () => void;
}) {
  const t = useTranslations('teams.templates.publish');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-foreground"
          aria-label={t('account')}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
          <span className="text-xs text-muted-foreground">{t('publishingAs')}</span>
          <span className="truncate">{publisher.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onChangeAuthor}>
          <UserPen />
          {t('authorProfile')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onChangeEmail}>
          <AtSign />
          {t('changeEmail')}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={TEMPLATE_GALLERY_RULES_URL} target="_blank" rel="noreferrer">
            <BookOpen />
            {t('rules')}
            <ExternalLink className="ms-auto" />
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onUnlink}>
          <Unlink />
          {t('unlink')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
