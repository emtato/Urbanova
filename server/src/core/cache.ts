import { createHash } from 'node:crypto';
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if (value && typeof value === 'object') return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
  return JSON.stringify(value);
}
export function cacheKey(input: unknown, dataVersion: string, modelVersion: string, random: unknown) {
  return createHash('sha256').update(canonical({input,dataVersion,modelVersion,random})).digest('hex');
}
export const hash = (input: unknown) => cacheKey(input,'','',{});
