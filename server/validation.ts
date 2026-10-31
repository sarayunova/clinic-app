import { z } from 'zod';

/** Optional numeric measurement with a plausible range and a plain-language error. */
export const measure = (min: number, max: number, integer = false) => {
  const range = `Enter a value between ${min} and ${max}`;
  const n = z.number({ error: 'Enter a number' });
  return (integer ? n.int(range) : n).min(min, range).max(max, range).nullable().optional();
};

export const round1 = (n: number | null | undefined) => (n == null ? null : Math.round(n * 10) / 10);
