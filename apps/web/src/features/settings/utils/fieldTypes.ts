import {
  AlignLeft,
  Calendar,
  CalendarClock,
  CalendarRange,
  CircleCheck,
  Hash,
  Link as LinkIcon,
  List,
  ListChecks,
  Type,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { CustomFieldType, MemberScope } from '@/lib/api';

// Every field type, in the order the picker shows them. Also the list a pasted
// transfer payload is validated against.
export const FIELD_TYPES: CustomFieldType[] = [
  'text',
  'markdown',
  'url',
  'number',
  'boolean',
  'date',
  'datetime',
  'datetime_range',
  'select',
  'multi_select',
  'member',
];

export const FIELD_TYPE_ICONS: Record<CustomFieldType, LucideIcon> = {
  text: Type,
  markdown: AlignLeft,
  url: LinkIcon,
  number: Hash,
  boolean: CircleCheck,
  date: Calendar,
  datetime: CalendarClock,
  datetime_range: CalendarRange,
  select: List,
  multi_select: ListChecks,
  member: UserRound,
};

// Who a member field may hold, in the order the picker shows them.
export const MEMBER_SCOPES: MemberScope[] = ['all', 'humans', 'agents'];

// Display labels for the field types. The stored value stays the enum key; a few
// read as jargon when shown raw, so they map to plain words in the messages.
export function useFieldTypeLabel() {
  const t = useTranslations('settings.customFields.fieldTypes');
  return (fieldType: CustomFieldType) => t(fieldType);
}
