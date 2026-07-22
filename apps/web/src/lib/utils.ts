import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// A string of digits to a positive integer, or null when empty/invalid. Used by the
// numeric inputs in the provider settings forms (port, timeout, expiry).
export function toPositiveInt(value: string): number | null {
  const n = Number(value);
  return value.trim() !== '' && Number.isInteger(n) && n > 0 ? n : null;
}
