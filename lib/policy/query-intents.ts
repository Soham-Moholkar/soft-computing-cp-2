export const queryIntents = {
  widow: 'widow support',
  single_parent: 'single parent support',
  orphan: 'support for an orphan',
  bereavement: 'support after my spouse died',
  delivery_bike: 'bike for delivery work',
  commercial_rickshaw: 'commercial auto-rickshaw',
  scholarship: 'education scholarship',
  business: 'small business support',
  equipment: 'business equipment',
  food: 'ration support',
  unclear: '',
} as const;

export type QueryIntent = keyof typeof queryIntents;

export function isQueryIntent(value: unknown): value is QueryIntent {
  return typeof value === 'string' && Object.hasOwn(queryIntents, value);
}

export function ambiguousWidowPhrase(value: string) {
  return /\bvideo\s+code\b/i.test(value);
}
