'use client';

import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, Check, ChevronDown, Copy, Globe, Loader2 } from 'lucide-react';
import type { ShareOptions, ShareState } from '@/lib/api/endpoints/share';
import { shareUrl } from '@/utils/paths';
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
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useFormatter, useTranslations } from 'next-intl';

const EXPIRY_PRESETS = [1, 3, 7] as const;

type ShareOptionName = 'extended' | 'includeChildren' | 'includeIssues';

const OPTION_TEXT = {
  extended: { label: 'fullDetails', hint: 'fullDetailsHint' },
  includeChildren: { label: 'includeSubpages', hint: 'includeSubpagesHint' },
  includeIssues: { label: 'includeIssues', hint: 'includeIssuesHint' },
} as const;

function inDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

// A link set to expire on a picked day works through the end of that day.
function endOfDay(day: Date): string {
  const at = new Date(day);
  at.setHours(23, 59, 59, 0);
  return at.toISOString();
}

// A generic public-share dialog for an issue, a saved view or a document. It shows the current
// state (shared with a copyable link, or not shared) and toggles it through the
// enable/disable callbacks. The caller supplies the current token, the enable
// (returns the new token) and disable operations, and the path builder that turns a
// token into the public URL. Anyone with the link gets read-only access.
export default function ShareDialog({
  open,
  onOpenChange,
  title,
  token,
  options,
  expiresAt,
  enable,
  disable,
  pathForToken,
  calendarPathForToken,
  notice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  token: string | null;
  // The current link's settings: whether an issue or a view shows its full details, or
  // whether a document's subpages and the issues it names come with it.
  options: { name: ShareOptionName; checked: boolean }[];
  // When the current link stops working, or null when it never does.
  expiresAt: string | null;
  // Creates the link, or changes the setting of a live one or when it expires;
  // returns its token and expiry.
  enable: (options: ShareOptions) => Promise<ShareState>;
  disable: () => Promise<void>;
  pathForToken: (token: string) => string;
  // The calendar feed path, for a shared view. Omitted by an issue share.
  calendarPathForToken?: (token: string) => string;
  // Shown under the dialog's description, whether or not the entity has a link.
  notice?: ReactNode;
}) {
  const t = useTranslations('common.share');
  const format = useFormatter();
  const [current, setCurrent] = useState<string | null>(token);
  const [expiry, setExpiry] = useState<string | null>(expiresAt);
  const [expiryOpen, setExpiryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedCalendar, setCopiedCalendar] = useState(false);

  // Seed from the latest token when the dialog opens; the prop can change while it
  // is mounted (the issue/view query refetched).
  const [seed, setSeed] = useState({ token, expiresAt });
  if ((seed.token !== token || seed.expiresAt !== expiresAt) && !busy) {
    setSeed({ token, expiresAt });
    setCurrent(token);
    setExpiry(expiresAt);
  }

  const url = current ? shareUrl(pathForToken(current)) : '';
  const calendarUrl =
    current && calendarPathForToken ? shareUrl(calendarPathForToken(current)) : '';

  async function run(operation: () => Promise<void>, failure: string) {
    setBusy(true);
    try {
      await operation();
    } catch {
      toast.error(failure);
    } finally {
      setBusy(false);
    }
  }

  function apply(state: ShareState) {
    setCurrent(state.token);
    setExpiry(state.expiresAt);
  }

  const onEnable = () =>
    run(
      async () =>
        apply(await enable(Object.fromEntries(options.map((option) => [option.name, false])))),
      t('createFailed'),
    );

  const onSetOption = (name: ShareOptionName, next: boolean) =>
    run(async () => apply(await enable({ [name]: next })), t('changeFailed'));

  const onSetExpiry = (next: string | null) => {
    setExpiryOpen(false);
    return run(async () => apply(await enable({ expiresAt: next })), t('expiryFailed'));
  };

  const onDisable = () =>
    run(async () => {
      await disable();
      setCurrent(null);
      setExpiry(null);
    }, t('stopFailed'));

  const expiryLabel = expiry
    ? t('expiresOn', {
        date: format.dateTime(new Date(expiry), { dateStyle: 'medium', timeStyle: 'short' }),
      })
    : t('neverExpires');

  async function copyText(value: string, mark: (copied: boolean) => void) {
    try {
      await navigator.clipboard.writeText(value);
      mark(true);
      setTimeout(() => mark(false), 1500);
    } catch {
      toast.error(t('copyFailed'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t('hint')}</DialogDescription>
        </DialogHeader>
        {notice}

        {current ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={url}
                aria-label={t('shareLink')}
                className="h-9 flex-1 bg-muted/40 font-mono text-xs"
                onFocus={(e) => e.target.select()}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-9"
                onClick={() => copyText(url, setCopied)}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? t('copied') : t('copy')}
              </Button>
            </div>

            {calendarUrl && (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm">{t('calendarFeed')}</span>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={calendarUrl}
                    aria-label={t('calendarFeed')}
                    className="h-9 flex-1 bg-muted/40 font-mono text-xs"
                    onFocus={(e) => e.target.select()}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-9"
                    onClick={() => copyText(calendarUrl, setCopiedCalendar)}
                  >
                    {copiedCalendar ? <Check className="size-4" /> : <Copy className="size-4" />}
                    {copiedCalendar ? t('copied') : t('copy')}
                  </Button>
                </div>
                <span className="text-xs text-muted-foreground">{t('calendarFeedHint')}</span>
              </div>
            )}

            {options.map((option) => (
              <label
                key={option.name}
                className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5"
              >
                <span className="min-w-0">
                  <span className="block text-sm">{t(OPTION_TEXT[option.name].label)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t(OPTION_TEXT[option.name].hint)}
                  </span>
                </span>
                <Switch
                  checked={option.checked}
                  disabled={busy}
                  onCheckedChange={(next) => void onSetOption(option.name, next)}
                />
              </label>
            ))}

            <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-sm">{t('expiry')}</span>
                <span className="block text-xs text-muted-foreground">{t('expiryHint')}</span>
              </span>
              <Popover open={expiryOpen} onOpenChange={setExpiryOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    className="h-8 shrink-0 gap-1.5 font-normal"
                  >
                    <CalendarClock className="size-4" />
                    {expiryLabel}
                    <ChevronDown className="size-3.5 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <div className="flex flex-col p-1">
                    <ExpiryOption
                      label={t('neverExpires')}
                      onSelect={() => void onSetExpiry(null)}
                    />
                    {EXPIRY_PRESETS.map((days) => (
                      <ExpiryOption
                        key={days}
                        label={t('expiresInDays', { count: days })}
                        onSelect={() => void onSetExpiry(inDays(days))}
                      />
                    ))}
                  </div>
                  <div className="border-t">
                    <p className="px-3 pt-2 text-xs text-muted-foreground">{t('expiryPickDate')}</p>
                    <Calendar
                      mode="single"
                      fixedWeeks
                      selected={expiry ? new Date(expiry) : undefined}
                      disabled={{ before: new Date() }}
                      onSelect={(day) => {
                        if (day) void onSetExpiry(endOfDay(day));
                      }}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <DialogFooter className="mt-1 sm:justify-start">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void onDisable()}
                className="text-muted-foreground hover:text-destructive"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                {t('stopSharing')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <DialogFooter>
            <Button type="button" disabled={busy} onClick={() => void onEnable()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Globe className="size-4" />}
              {t('createLink')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ExpiryOption({ label, onSelect }: { label: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
    >
      {label}
    </button>
  );
}
