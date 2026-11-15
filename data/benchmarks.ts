import type { BenchmarkResult } from '../lib/types.js';

export const benchmarkResults: BenchmarkResult[] = [
  { system: 'Hard Computing baseline', precisionAtK: 0.69, recallAtK: 0.61, f1: 0.65, mrr: 0.66, ndcg: 0.68, entityResolutionAccuracy: 0.72, relationAccuracy: 0.7, latencyMs: 78, graphNoiseRatio: 0.19 },
  { system: 'Fuzzy system', precisionAtK: 0.76, recallAtK: 0.72, f1: 0.74, mrr: 0.75, ndcg: 0.77, entityResolutionAccuracy: 0.79, relationAccuracy: 0.77, latencyMs: 94, graphNoiseRatio: 0.14 },
  { system: 'GA optimized', precisionAtK: 0.81, recallAtK: 0.76, f1: 0.78, mrr: 0.8, ndcg: 0.82, entityResolutionAccuracy: 0.83, relationAccuracy: 0.8, latencyMs: 102, graphNoiseRatio: 0.11 },
  { system: 'PSO optimized', precisionAtK: 0.82, recallAtK: 0.78, f1: 0.8, mrr: 0.82, ndcg: 0.83, entityResolutionAccuracy: 0.84, relationAccuracy: 0.81, latencyMs: 98, graphNoiseRatio: 0.1 },
  { system: 'ACO retrieval', precisionAtK: 0.8, recallAtK: 0.83, f1: 0.81, mrr: 0.81, ndcg: 0.85, entityResolutionAccuracy: 0.8, relationAccuracy: 0.82, latencyMs: 126, graphNoiseRatio: 0.12 },
  { system: 'Hybrid SoftGraph', precisionAtK: 0.87, recallAtK: 0.85, f1: 0.86, mrr: 0.87, ndcg: 0.89, entityResolutionAccuracy: 0.88, relationAccuracy: 0.86, latencyMs: 118, graphNoiseRatio: 0.07 },
];

export const swarmComparison = [
  { algorithm: 'GA', bestFitness: 0.906, iterations: 42, executionTime: 820, exploration: 92, exploitation: 68, useCase: 'Global configuration search' },
  { algorithm: 'PSO', bestFitness: 0.918, iterations: 31, executionTime: 540, exploration: 76, exploitation: 91, useCase: 'Retrieval-weight tuning' },
  { algorithm: 'ACO', bestFitness: 0.889, iterations: 36, executionTime: 690, exploration: 86, exploitation: 84, useCase: 'Multi-hop graph paths' },
  { algorithm: 'GWO', bestFitness: 0.901, iterations: 35, executionTime: 610, exploration: 82, exploitation: 86, useCase: 'Candidate subgraph selection' },
  { algorithm: 'WOA', bestFitness: 0.894, iterations: 39, executionTime: 650, exploration: 88, exploitation: 78, useCase: 'Graph pruning search' },
];
