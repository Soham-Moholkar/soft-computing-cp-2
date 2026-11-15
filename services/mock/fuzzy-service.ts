import { evaluateRetrievalFuzzy } from '../../lib/algorithms/fuzzy.js';
import type { FuzzyService } from '../contracts.js';

export const mockFuzzyService: FuzzyService = {
  async evaluate(input) {
    // TODO(PASS-2): Replace with POST /api/fuzzy/evaluate defined in docs/API_CONTRACTS.md.
    return evaluateRetrievalFuzzy(input);
  },
};
