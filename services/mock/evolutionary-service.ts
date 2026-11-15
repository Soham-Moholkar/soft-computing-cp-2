import { simulateGeneticAlgorithm } from '../../lib/algorithms/genetic.js';
import type { EvolutionaryService } from '../contracts.js';

export const mockEvolutionaryService: EvolutionaryService = {
  async optimize(config) {
    // TODO(PASS-2): Replace with POST /api/ga/optimize defined in docs/API_CONTRACTS.md.
    return simulateGeneticAlgorithm(config);
  },
};
