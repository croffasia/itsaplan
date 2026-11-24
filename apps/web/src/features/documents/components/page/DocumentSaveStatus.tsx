import {
  Archive,
  Check,
  CircleAlert,
  Eye,
  LoaderCircle,
  Lock,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { DocumentPageStatus } from '../../utils/documentPageStatus';

const STATUS = {
  archived: { icon: Archive, label: 'archivedReadOnly', tone: null },
  viewOnly: { icon: Eye, label: 'viewOnly', tone: null },
  locked: { icon: Lock, label: 'lockedReadOnly', tone: null },
  recovery: { icon: CircleAlert, label: 'notSynced', tone: 'warn' },
  sessionConflict: { icon: CircleAlert, label: 'notSynced', tone: 'danger' },
  offline: { icon: WifiOff, label: 'offline', tone: 'warn' },
  connecting: { icon: LoaderCircle, label: 'connecting', tone: 'spin' },
  error: { icon: CircleAlert, label: 'saveFailed', tone: 'danger' },
  conflict: { icon: CircleAlert, label: 'conflict', tone: 'warn' },
  saving: { icon: LoaderCircle, label: 'saving', tone: 'spin' },
  saved: { icon: Check, label: 'saved', tone: null },
} as const satisfies Record<
  DocumentPageStatus,
  { icon: LucideIcon; label: string; tone: 'warn' | 'danger' | 'spin' | null }
>;

export default function DocumentSaveStatus({ status }: { status: DocumentPageStatus }) {
  const t = useTranslations('documents');
  const { icon: Icon, label, tone } = STATUS[status];

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-1.5 px-2 text-xs whitespace-nowrap text-muted-foreground max-md:hidden',
        tone === 'warn' && 'text-warning',
        tone === 'danger' && 'text-destructive',
      )}
    >
      <Icon
        className={cn('size-3', tone === 'spin' && 'animate-spin motion-reduce:animate-none')}
        aria-hidden
      />
      {t(label)}
    </span>
  );
}
