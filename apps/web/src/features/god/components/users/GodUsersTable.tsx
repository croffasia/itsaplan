'use client';

import { Bot, Pencil, Shield } from 'lucide-react';
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
import { providerList } from '../../utils/providers';

// The account list. A row (or the pencil in its Actions cell) opens the account in
// the side panel, where the email can be confirmed and the account deleted.
export default function GodUsersTable({
  users,
  onSelect,
}: {
  users: InstanceUser[];
  onSelect: (userId: string) => void;
}) {
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
          <TableHead className="text-xs font-medium text-muted-foreground">Account</TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">Role</TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">Sign-in</TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">Projects</TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">Last seen</TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">Email</TableHead>
          <TableHead className="text-right text-xs font-medium text-muted-foreground">
            Actions
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((u) => (
          <TableRow
            key={u.id}
            className="cursor-pointer"
            onClick={() => onSelect(u.id)}
            title="Show project access"
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
                    joined {formatShortDate(u.createdAt)}
                  </span>
                </div>
              </div>
            </TableCell>

            <TableCell className="px-3 py-3 align-top">
              <div className="flex flex-wrap gap-1">
                {u.role === 'god' ? (
                  <Badge className="gap-1 px-1.5 py-0 text-[10px] font-medium">
                    <Shield className="size-3" />
                    God
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium">
                    User
                  </Badge>
                )}
                {u.isAgent && (
                  <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px] font-medium">
                    <Bot className="size-3" />
                    Agent
                  </Badge>
                )}
              </div>
            </TableCell>

            <TableCell className="px-3 py-3 align-top text-xs text-muted-foreground">
              {u.providers.length ? providerList(u.providers) : 'none'}
            </TableCell>

            <TableCell className="px-3 py-3 align-top text-sm">{u.projectCount}</TableCell>

            <TableCell className="px-3 py-3 align-top text-xs text-muted-foreground">
              {u.lastSeenAt ? formatShortDate(u.lastSeenAt) : 'never'}
            </TableCell>

            <TableCell className="px-3 py-3 align-top">
              {u.emailVerified ? (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium">
                  Verified
                </Badge>
              ) : (
                <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-medium">
                  Not verified
                </Badge>
              )}
            </TableCell>

            <TableCell className="px-3 py-3 text-right align-top">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                aria-label="Open account"
                title="Open account"
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
