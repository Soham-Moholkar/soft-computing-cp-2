import { benchmarkResults } from '../../data/benchmarks.js';
import type { BenchmarkService } from '../contracts.js';

export const mockBenchmarkService: BenchmarkService = {
  async getResults() {
    // TODO(PASS-2): Replace with GET /api/benchmark defined in docs/API_CONTRACTS.md.
    return benchmarkResults;
  },
};
