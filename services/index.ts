import { mockBenchmarkService } from './mock/benchmark-service.js';
import { mockEvolutionaryService } from './mock/evolutionary-service.js';
import { mockExplanationService } from './mock/explanation-service.js';
import { mockFuzzyService } from './mock/fuzzy-service.js';
import { mockGraphService } from './mock/graph-service.js';
import { mockHybridService } from './mock/hybrid-service.js';
import { mockIngestionService } from './mock/ingestion-service.js';
import { mockRetrievalService } from './mock/retrieval-service.js';
import { mockSwarmService } from './mock/swarm-service.js';
import { ApiClient, type ApiClientOptions } from './api/client.js';
import { createRestGraphService } from './api/graph-service.js';
import { createRestIngestionService } from './api/ingestion-service.js';
import { createRestFuzzyService } from './api/fuzzy-service.js';
import { createRestRetrievalService, createRestExplanationService } from './api/retrieval-service.js';
import { createRestEvolutionaryService, createRestSwarmService } from './api/optimization-service.js';
import { createRestBenchmarkService } from './api/benchmark-service.js';

export type ServiceMode = 'mock' | 'api';

export const apiModeMockFallbacks = [] as const;

export function resolveServiceMode(value = process.env.NEXT_PUBLIC_SERVICE_MODE): ServiceMode {
  if (value === undefined || value === '' || value === 'api') return 'api';
  if (value === 'mock') return 'mock';
  throw new Error(`Invalid NEXT_PUBLIC_SERVICE_MODE '${value}'. Use 'mock' or 'api'.`);
}

export function createServices(mode = resolveServiceMode(), apiOptions?: ApiClientOptions) {
  const graph = mode === 'api' ? createRestGraphService(new ApiClient(apiOptions)) : mockGraphService;
  const ingestion = mode === 'api' ? createRestIngestionService(new ApiClient(apiOptions)) : mockIngestionService;
  const fuzzy = mode === 'api' ? createRestFuzzyService(new ApiClient(apiOptions)) : mockFuzzyService;
  const retrieval = mode === 'api' ? createRestRetrievalService(new ApiClient(apiOptions)) : mockRetrievalService;
  return {
    ingestion,
    graph,
    fuzzy,
    evolutionary: mode === 'api' ? createRestEvolutionaryService(new ApiClient(apiOptions)) : mockEvolutionaryService,
    swarm: mode === 'api' ? createRestSwarmService(new ApiClient(apiOptions)) : mockSwarmService,
    hybrid: mode === 'api' ? createRestRetrievalService(new ApiClient(apiOptions)) : mockHybridService,
    retrieval,
    explanation: mode === 'api' ? createRestExplanationService(new ApiClient(apiOptions)) : mockExplanationService,
    benchmark: mode === 'api' ? createRestBenchmarkService(new ApiClient(apiOptions)) : mockBenchmarkService,
  } as const;
}

export const serviceMode = resolveServiceMode();
export const services = createServices(serviceMode);
