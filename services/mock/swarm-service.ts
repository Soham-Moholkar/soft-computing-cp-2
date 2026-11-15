import type { OptimizerRun } from '../../lib/types.js';
import type { SwarmService } from '../contracts.js';

function curve(algorithm: 'PSO' | 'GWO' | 'WOA', iterations: number): OptimizerRun {
  const rates = { PSO: 4.8, GWO: 5.8, WOA: 6.5 };
  const ceilings = { PSO: 0.922, GWO: 0.904, WOA: 0.896 };
  const convergence = Array.from({ length: iterations }, (_, index) => ({
    iteration: index + 1,
    fitness: 0.5 + (ceilings[algorithm] - 0.5) * (1 - Math.exp(-(index + 1) / rates[algorithm])),
  }));
  return {
    algorithm,
    convergence,
    bestFitness: convergence[convergence.length - 1]?.fitness ?? 0,
    bestVector: algorithm === 'PSO' ? [0.29, 0.19, 0.2, 0.09, 0.05, 0.1, 0.08] : [0.64, 0.71, 0.56, 0.83],
    executionTimeMs: Math.round(iterations * (algorithm === 'PSO' ? 17 : algorithm === 'GWO' ? 20 : 22)),
  };
}

export const mockSwarmService: SwarmService = {
  async optimize(algorithm, iterations) {
    // TODO(PASS-2): Replace with POST /api/pso|gwo|woa/optimize from docs/API_CONTRACTS.md.
    return curve(algorithm, iterations);
  },
  async searchGraph(_query, maxHops) {
    // TODO(PASS-2): Replace with POST /api/aco/search defined in docs/API_CONTRACTS.md.
    return [
      { labels: ['Particle Swarm Optimization', 'Retrieval Relevance', 'Knowledge Graph'], score: 0.91, pheromone: 0.88 },
      { labels: ['Particle Swarm Optimization', 'Optimization', 'Machine Learning', 'Knowledge Graph'], score: 0.84, pheromone: 0.73 },
      { labels: ['Swarm Intelligence', 'Ant Colony Optimization', 'Graph Traversal', 'Knowledge Graph'].slice(0, maxHops + 1), score: 0.79, pheromone: 0.66 },
    ];
  },
};
