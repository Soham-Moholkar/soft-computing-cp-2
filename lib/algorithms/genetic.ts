import type { OptimizerConfig, OptimizerRun } from '../types.js';

function seededValue(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

export function normalizeWeights(values: number[]): number[] {
  const safe = values.map((value) => Math.max(0, Math.min(1, value)));
  const sum = safe.reduce((total, value) => total + value, 0);
  if (sum === 0) return safe.map(() => 1 / safe.length);
  return safe.map((value) => value / sum);
}

export function mutateChromosome(chromosome: number[], rate: number, seed = 17): number[] {
  return chromosome.map((gene, index) => {
    if (seededValue(seed + index) > rate) return gene;
    const delta = (seededValue(seed * 3 + index) - 0.5) * 0.24;
    return Math.max(0, Math.min(1, gene + delta));
  });
}

export function crossover(parentA: number[], parentB: number[], point: number): [number[], number[]] {
  const split = Math.max(1, Math.min(parentA.length - 1, point));
  return [
    parentA.slice(0, split).concat(parentB.slice(split)),
    parentB.slice(0, split).concat(parentA.slice(split)),
  ];
}

export function validateOptimizerConfig(config: OptimizerConfig): string[] {
  const errors: string[] = [];
  if (config.populationSize < 4 || config.populationSize > 500) errors.push('Population size must be between 4 and 500.');
  if (config.iterations < 1 || config.iterations > 1000) errors.push('Iterations must be between 1 and 1000.');
  if (config.mutationRate < 0 || config.mutationRate > 1) errors.push('Mutation rate must be between 0 and 1.');
  if (config.crossoverRate < 0 || config.crossoverRate > 1) errors.push('Crossover rate must be between 0 and 1.');
  return errors;
}

export function simulateGeneticAlgorithm(config: OptimizerConfig): OptimizerRun {
  const convergence = Array.from({ length: config.iterations }, (_, index) => {
    const progress = 1 - Math.exp(-(index + 1) / Math.max(5, config.iterations / 4));
    const exploration = (seededValue(index + config.populationSize) - 0.5) * 0.025 * (1 - progress);
    return { iteration: index + 1, fitness: Math.min(0.94, 0.52 + progress * 0.4 + exploration) };
  });
  const seedVector = [0.69, 0.61, 0.28, 0.17, 0.2, 0.1, 0.08, 0.11];
  return {
    algorithm: 'GA',
    convergence,
    bestFitness: convergence[convergence.length - 1]?.fitness ?? 0,
    bestVector: mutateChromosome(seedVector, config.mutationRate, config.populationSize),
    executionTimeMs: Math.round(config.populationSize * config.iterations * 0.86),
  };
}
