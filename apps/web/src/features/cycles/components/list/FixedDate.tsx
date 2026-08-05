import { formatDate } from '@/utils/dates';

// A date the form cannot change, written out plainly. A control that opens nothing
// would read as editable, so a running or finished cycle shows its fixed dates as
// text instead.
export default function FixedDate({ value }: { value: string }) {
  return <span className="flex h-7 items-center px-1 text-sm">{formatDate(value)}</span>;
}
