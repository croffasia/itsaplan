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
import type { LinkableCustomer, ManagedServer, ServerAuthType, ServerInput } from '@/lib/api';

const NO_CUSTOMER = 'none';

export default function ServerFormDialog({
  open,
  editing,
  customers,
  saving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  editing: ManagedServer | null;
  customers: LinkableCustomer[];
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: ServerInput) => void;
}) {
  const [label, setLabel] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('root');
  const [authType, setAuthType] = useState<ServerAuthType>('key');
  const [secret, setSecret] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [customerId, setCustomerId] = useState<string>(NO_CUSTOMER);
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');

  // Refills when a different server is opened for editing. The credential is never
  // sent back by the API, so that field always starts empty: leaving it empty keeps
  // the stored one.
  useEffect(() => {
    if (!open) return;
    setLabel(editing?.label ?? '');
    setHost(editing?.host ?? '');
    setPort(String(editing?.port ?? 22));
    setUsername(editing?.username ?? 'root');
    setAuthType(editing?.authType ?? 'key');
    setSecret('');
    setPassphrase('');
    setCustomerId(editing?.customerId != null ? String(editing.customerId) : NO_CUSTOMER);
    setTags((editing?.tags ?? []).join(' '));
    setNotes(editing?.notes ?? '');
  }, [open, editing]);

  const canSave =
    label.trim().length > 0 &&
    host.trim().length > 0 &&
    username.trim().length > 0 &&
    (editing != null || secret.trim().length > 0);

  const submit = () => {
    onSubmit({
      label: label.trim(),
      host: host.trim(),
      port: Number(port) || 22,
      username: username.trim(),
      authType,
      secret: secret.trim(),
      ...(passphrase.trim().length > 0 ? { passphrase: passphrase.trim() } : {}),
      ...(customerId !== NO_CUSTOMER ? { customerId: Number(customerId) } : {}),
      tags: tags
        .split(/[\s,]+/)
        .map((tag) => tag.replace(/^#/, '').toLowerCase())
        .filter((tag) => tag.length > 0)
        .slice(0, 12),
      notes: notes.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit server' : 'Add a server'}</DialogTitle>
          <DialogDescription>
            The credential is encrypted before it is stored and never leaves the server. Anyone with
            terminal access to this project can open a shell on this machine.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="server-label">Name</Label>
            <Input
              id="server-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Web server — Acme"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <div className="space-y-2">
              <Label htmlFor="server-host">Host</Label>
              <Input
                id="server-host"
                value={host}
                onChange={(event) => setHost(event.target.value)}
                placeholder="82.108.131.28"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="server-port">Port</Label>
              <Input
                id="server-port"
                value={port}
                inputMode="numeric"
                onChange={(event) => setPort(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="server-user">User</Label>
              <Input
                id="server-user"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="server-auth">Authentication</Label>
              <Select value={authType} onValueChange={(v) => setAuthType(v as ServerAuthType)}>
                <SelectTrigger id="server-auth" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="key">Private key</SelectItem>
                  <SelectItem value="password">Password</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="server-secret">
              {authType === 'key' ? 'Private key' : 'Password'}
              {editing && (
                <span className="ml-2 text-xs text-muted-foreground">(leave empty to keep)</span>
              )}
            </Label>
            {authType === 'key' ? (
              <Textarea
                id="server-secret"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                className="min-h-28 font-mono text-xs"
              />
            ) : (
              <Input
                id="server-secret"
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
              />
            )}
          </div>

          {authType === 'key' && (
            <div className="space-y-2">
              <Label htmlFor="server-passphrase">Key passphrase</Label>
              <Input
                id="server-passphrase"
                type="password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                placeholder="Only if the key is encrypted"
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="server-customer">Customer</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger id="server-customer" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CUSTOMER}>Our own machine</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={String(customer.id)}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="server-tags">Tags</Label>
              <Input
                id="server-tags"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="production web"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="server-notes">Notes</Label>
            <Textarea
              id="server-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="What runs here, and anything worth knowing before you touch it."
              className="min-h-20"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!canSave || saving} onClick={submit}>
            {editing ? 'Save' : 'Add server'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
