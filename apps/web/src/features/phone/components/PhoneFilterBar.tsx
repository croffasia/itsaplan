'use client';

import { Search } from 'lucide-react';
import type { PhoneNumber } from '@/lib/api';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DIRECTION_FILTERS, STATUS_FILTERS } from '../utils/phone';

export default function PhoneFilterBar({
  search,
  direction,
  status,
  numberId,
  numbers,
  onChange,
}: {
  search: string;
  direction: string;
  status: string;
  numberId: string;
  numbers: PhoneNumber[];
  onChange: (key: 'search' | 'direction' | 'status' | 'numberId', value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative max-w-xs flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          placeholder="Search a number or contact…"
          className="pl-9"
          onChange={(event) => onChange('search', event.target.value)}
        />
      </div>

      <Select value={direction} onValueChange={(value) => onChange('direction', value)}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DIRECTION_FILTERS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={status} onValueChange={(value) => onChange('status', value)}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_FILTERS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {numbers.length > 1 && (
        <Select value={numberId} onValueChange={(value) => onChange('numberId', value)}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All numbers</SelectItem>
            {numbers.map((number) => (
              <SelectItem key={number.id} value={number.id}>
                {number.label || number.number}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
