'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

// The search box above a directory table. It drives a server-side query, so typing
// here refetches a page rather than filtering what is on screen.
export default function GodSearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 pl-8"
      />
    </div>
  );
}
