'use client';

import { useMemo } from 'react';
import { canonicalTimezone } from '@/utils/dates';
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from '@/components/ui/combobox';

// The regions IANA zone names start with, in the order they are listed. A zone whose
// prefix is not one of these (UTC, GMT, legacy aliases) falls into "Other".
const REGIONS = [
  { prefix: 'America', label: 'Americas' },
  { prefix: 'Europe', label: 'Europe' },
  { prefix: 'Africa', label: 'Africa' },
  { prefix: 'Asia', label: 'Asia' },
  { prefix: 'Australia', label: 'Australia' },
  { prefix: 'Pacific', label: 'Pacific' },
  { prefix: 'Atlantic', label: 'Atlantic' },
  { prefix: 'Indian', label: 'Indian Ocean' },
  { prefix: 'Antarctica', label: 'Antarctica' },
] as const;

// Every zone the browser's own Intl data knows, so the list matches what the runtime
// can actually format in, with renamed zones under their current name. Engines
// without supportedValuesOf fall back to the detected zone plus UTC.
function zoneList(): string[] {
  const supported = Intl.supportedValuesOf?.('timeZone');
  if (!supported?.length) {
    const detected = canonicalTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    return detected && detected !== 'UTC' ? [detected, 'UTC'] : ['UTC'];
  }
  return [...new Set(supported.map(canonicalTimezone))].sort();
}

// The zone's current offset, e.g. "GMT+2".
function zoneOffset(zone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

// "Europe/Kyiv" reads as "(GMT+2) Kyiv"; "America/Argentina/Salta" keeps both parts.
// Search matches this label, so typing a city or an offset finds the zone.
function zoneLabel(zone: string): string {
  const parts = zone.split('/');
  const city = (parts.length > 1 ? parts.slice(1) : parts).join(' / ').replace(/_/g, ' ');
  const offset = zoneOffset(zone);
  return offset ? `(${offset}) ${city}` : city;
}

function groupZones(zones: string[]): { value: string; items: string[] }[] {
  const groups = REGIONS.map((r) => ({
    value: r.label,
    items: zones.filter((z) => z.startsWith(`${r.prefix}/`)),
  }));
  const grouped = new Set(groups.flatMap((g) => g.items));
  const other = zones.filter((z) => !grouped.has(z));
  return [...groups, { value: 'Other', items: other }].filter((g) => g.items.length > 0);
}

// Timezone picker: every zone the runtime knows, grouped by region and searchable by
// city or offset. The stored value is the IANA zone name.
export default function AccountPreferencesTimezone({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (timezone: string) => void;
  disabled: boolean;
}) {
  const groups = useMemo(() => groupZones(zoneList()), []);
  // A label costs an Intl.DateTimeFormat and the list asks for one on every render
  // and every keystroke in the search field, so each is built on first use and kept.
  // Building all of them up front would block the page opening for several hundred
  // zones, most of which are never rendered.
  const labels = useMemo(() => new Map<string, string>(), []);
  const labelOf = (zone: string) => {
    const known = labels.get(zone);
    if (known) return known;
    const label = zoneLabel(zone);
    labels.set(zone, label);
    return label;
  };

  return (
    <Combobox
      items={groups}
      value={canonicalTimezone(value)}
      onValueChange={(zone: string | null) => zone && onChange(zone)}
      itemToStringLabel={labelOf}
      disabled={disabled}
    >
      {/* The input shows the selected zone, so select it on focus: typing then
          replaces it instead of appending to it. */}
      <ComboboxInput
        placeholder="Select a timezone"
        className="w-full sm:w-44"
        onFocus={(e) => e.currentTarget.select()}
      />
      <ComboboxContent>
        <ComboboxEmpty>No timezones found.</ComboboxEmpty>
        <ComboboxList>
          {(group: { value: string; items: string[] }) => (
            <ComboboxGroup key={group.value} items={group.items}>
              <ComboboxLabel>{group.value}</ComboboxLabel>
              <ComboboxCollection>
                {(zone: string) => (
                  <ComboboxItem key={zone} value={zone}>
                    {labelOf(zone)}
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
