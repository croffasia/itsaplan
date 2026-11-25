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
import type { CustomFieldType } from '@/lib/api/endpoints/customFields';

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
