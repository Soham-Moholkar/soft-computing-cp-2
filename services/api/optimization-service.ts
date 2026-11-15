import { ApiClient } from './client.js';
import { pollJob } from './polling.js';
import type { EvolutionaryService, SwarmService } from '../contracts.js';

export type SearchAlgorithm =
  | 'GA'
  | 'PSO'
  | 'GWO'
  | 'WOA'
  | 'FUZZY_GA'
  | 'GA_PSO'
  | 'NEURO_FUZZY';
export interface OptimizationJob {
  job_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  created_at: string;
  error: string | null;
  request: {
    algorithm: SearchAlgorithm;
    seed: number;
    dataset: 'synthetic' | 'real';
    evaluation_budget: number;
  };
  artifact: Record<string, unknown> | null;
  result: {
    algorithm: SearchAlgorithm;
    evaluations?: number;
    training_steps?: number;
    training_pairs?: number;
    best_vector: number[];
    best_metrics: {
      fitness: number;
      ndcg_at_k: number;
      recall_at_k: number;
      baseline_p95_ms: number;
    };
    baseline_metrics?: { fitness: number; ndcg_at_k: number };
    execution_time_ms?: number;
    trace: Array<{
      evaluation?: number;
      step?: number;
      phase?: string;
      best_fitness?: number;
      train_pairwise_loss?: number;
    }>;
    provenance: {
      dataset_version: string;
      dataset_sha256: string;
      domain: string;
      review_status: string;
      limitations: string[];
    };
  } | null;
}

export async function waitForOptimization(
  client: ApiClient,
  job: OptimizationJob,
  signal?: AbortSignal,
): Promise<OptimizationJob> {
  return pollJob({
    initial: job,
    load: (pollSignal) =>
      client.get<OptimizationJob>(
        `/optimization/jobs/${encodeURIComponent(job.job_id)}`,
        pollSignal,
      ),
    signal,
    timeoutMessage: `Run ${job.job_id} is still processing. Reopen it in recent runs.`,
    failureMessage: 'Optimization failed.',
  });
}

export function createRestEvolutionaryService(
  client = new ApiClient(),
): EvolutionaryService {
  return {
    async optimize(config) {
      if (config.encoding !== 'real')
        throw new Error(
          'The backend optimizer uses real-valued simplex weights. Binary encoding is an educational demo.',
        );
      const population = Math.max(4, Math.min(32, config.populationSize));
      const budget = Math.max(
        population,
        Math.min(256, Math.max(8, config.iterations * population)),
      );
      const job = await waitForOptimization(
        client,
        await client.post<OptimizationJob>('/optimization/jobs', {
          algorithm: 'GA',
          evaluation_budget: budget,
          population_size: population,
          mutation_rate: config.mutationRate,
          crossover_rate: config.crossoverRate,
          selection: config.selection,
          seed: 17,
          dataset: 'synthetic',
        }),
      );
      const run = job.result!;
      return {
        algorithm: 'GA',
        bestFitness: run.best_metrics.fitness,
        bestVector: run.best_vector,
        executionTimeMs: run.execution_time_ms ?? 0,
        convergence: run.trace.map((row) => ({
          iteration: row.evaluation!,
          fitness: row.best_fitness!,
        })),
      };
    },
  };
}

export function createRestSwarmService(client = new ApiClient()): SwarmService {
  return {
    async optimize(algorithm, iterations) {
      const job = await waitForOptimization(
        client,
        await client.post<OptimizationJob>('/optimization/jobs', {
          algorithm,
          evaluation_budget: Math.max(8, Math.min(256, iterations)),
          population_size: 8,
          seed: 17,
          dataset: 'synthetic',
        }),
      );
      const run = job.result!;
      return {
        algorithm,
        bestFitness: run.best_metrics.fitness,
        bestVector: run.best_vector,
        executionTimeMs: run.execution_time_ms ?? 0,
        convergence: run.trace.map((row) => ({
          iteration: row.evaluation!,
          fitness: row.best_fitness!,
        })),
      };
    },
    async searchGraph(query, maxHops) {
      const graph = await client.get<{
        entities: Array<{
          entity_id: string;
          canonical_name: string;
          aliases: string[];
        }>;
      }>('/graph?limit=500');
      const nodes = graph.entities.filter((node) =>
        [node.canonical_name, ...node.aliases].some((name) =>
          query.toLowerCase().includes(name.toLowerCase()),
        ),
      );
      if (nodes.length < 2)
        throw new Error(
          'Choose a query naming two built graph concepts for ACO.',
        );
      const result = await client.post<{
        paths: Array<{ labels: string[]; score: number; pheromone: number }>;
      }>('/aco/search', {
        source_entity: nodes[0].entity_id,
        target_entity: nodes[nodes.length - 1].entity_id,
        max_hops: maxHops,
      });
      return result.paths;
    },
  };
}
