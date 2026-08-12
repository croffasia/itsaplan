'use client';

import { Bot, Pencil, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { InstanceUser } from '@/lib/api';
import { formatShortDate } from '@/utils/dates';
import Avatar from '@/components/common/Avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useProviderList } from '../../hooks/useProviderList';

// The account list. A row (or the pencil in its Actions cell) opens the account in
// the side panel, where the email can be confirmed and the account deleted.
export default function GodUsersTable({
  users,
  onSelect,
}: {
  users: InstanceUser[];
  onSelect: (userId: string) => void;
}) {
  const t = useTranslations('god.users');
  const tCommon = useTranslations('common');
  const providerList = useProviderList();

  return (
    <Table className="min-w-[900px] table-fixed">
      <colgroup>
        <col className="w-[30%]" />
        <col className="w-[12%]" />
        <col className="w-[15%]" />
        <col className="w-[9%]" />
        <col className="w-[13%]" />
        <col className="w-[13%]" />
        <col className="w-[8%]" />
      </colgroup>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="text-xs font-medium text-muted-foreground">
            {t('columns.account')}
          </TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">
            {t('columns.role')}
          </TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">
            {t('columns.signIn')}
          </TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">
            {t('columns.projects')}
          </TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">
            {t('columns.lastSeen')}
          </TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">
            {t('columns.email')}
          </TableHead>
          <TableHead className="text-right text-xs font-medium text-muted-foreground">
            {tCommon('actions')}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((u) => (
          <TableRow
            key={u.id}
            className="cursor-pointer"
            onClick={() => onSelect(u.id)}
            title={t('showAccess')}
          >
            <TableCell className="px-3 py-3 align-top whitespace-normal">
              <div className="flex min-w-0 items-start gap-2.5">
                <Avatar
                  name={u.name || u.email}
                  image={u.image}
                  className="size-8 shrink-0 text-[11px]"
                />
                <div className="flex min-w-0 flex-col gap-0.5 pt-0.5">
                  <span className="truncate text-sm font-medium">{u.name || u.email}</span>
                  <span className="truncate text-xs text-muted-foreground">{u.email}</span>
                  <span className="text-xs text-muted-foreground">
                    {t('registered', { date: formatShortDate(u.createdAt) })}
                  </span>
                </div>
              </div>
            </TableCell>

            <TableCell className="px-3 py-3 align-top">
              <div className="flex flex-wrap gap-1">
                {u.role === 'god' ? (
                  <Badge className="gap-1 px-1.5 py-0 text-[10px] font-medium">
                    <Shield className="size-3" />
                    {t('roleGod')}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium">
                    {t('roleUser')}
                  </Badge>
                )}
                {u.isAgent && (
                  <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px] font-medium">
                    <Bot className="size-3" />
                    {t('agent')}
                  </Badge>
                )}
              </div>
            </TableCell>

            <TableCell className="px-3 py-3 align-top text-xs text-muted-foreground">
              {u.providers.length ? providerList(u.providers) : t('noProviders')}
            </TableCell>

            <TableCell className="px-3 py-3 align-top text-sm">{u.projectCount}</TableCell>

            <TableCell className="px-3 py-3 align-top text-xs text-muted-foreground">
              {u.lastSeenAt ? formatShortDate(u.lastSeenAt) : t('neverSeen')}
            </TableCell>

            <TableCell className="px-3 py-3 align-top">
              {u.emailVerified ? (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium">
                  {t('verified')}
                </Badge>
              ) : (
                <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-medium">
                  {t('notVerified')}
                </Badge>
              )}
            </TableCell>

            <TableCell className="px-3 py-3 text-right align-top">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                aria-label={t('open')}
                title={t('open')}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(u.id);
                }}
              >
                <Pencil />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
