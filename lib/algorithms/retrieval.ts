import type { ScoreContribution, SyllabusEntry } from '../types.js';

export interface RetrievalSignals {
  semantic: number;
  graph: number;
  fuzzy: number;
  centrality: number;
  source: number;
  temporal: number;
  path: number;
}

export type RetrievalWeights = Record<keyof RetrievalSignals, number>;

export function calculateHybridScore(signals: RetrievalSignals, weights: RetrievalWeights): {
  score: number;
  breakdown: ScoreContribution[];
} {
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + Math.max(0, weight), 0);
  const safeTotal = totalWeight || 1;
  const breakdown = (Object.keys(signals) as Array<keyof RetrievalSignals>).map((component) => {
    const rawScore = Math.max(0, Math.min(1, signals[component]));
    const weight = Math.max(0, weights[component]) / safeTotal;
    return { component, rawScore, weight, contribution: rawScore * weight };
  });
  return { score: breakdown.reduce((sum, item) => sum + item.contribution, 0), breakdown };
}

export function filterSyllabus(entries: SyllabusEntry[], filter: string, query: string): SyllabusEntry[] {
  const normalizedFilter = filter.toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();
  return entries.filter((entry) => {
    const matchesFilter =
      normalizedFilter === 'all' ||
      entry.unit.toLowerCase() === normalizedFilter ||
      entry.category.toLowerCase() === normalizedFilter ||
      entry.whereUsed.toLowerCase().includes(normalizedFilter);
    const haystack = Object.values(entry).join(' ').toLowerCase();
    return matchesFilter && (!normalizedQuery || haystack.includes(normalizedQuery));
  });
}
