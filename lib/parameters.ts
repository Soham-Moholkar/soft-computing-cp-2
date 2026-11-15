export interface ParameterDefinition {
  key: string;
  label: string;
  defaultValue: number | string;
  range: string;
  purpose: string;
}

export const parameterRegistry: Record<string, ParameterDefinition[]> = {
  Ingestion: [
    { key: 'chunk_size', label: 'Chunk size', defaultValue: 512, range: '128–2048 tokens', purpose: 'Maximum semantic unit size.' },
    { key: 'chunk_overlap', label: 'Chunk overlap', defaultValue: 64, range: '0–256 tokens', purpose: 'Preserves context across boundaries.' },
    { key: 'minimum_chunk_length', label: 'Minimum chunk length', defaultValue: 80, range: '16–512 tokens', purpose: 'Rejects low-information fragments.' },
  ],
  Extraction: [
    { key: 'entity_threshold', label: 'Entity threshold', defaultValue: 0.62, range: '0–1', purpose: 'Initial candidate acceptance.' },
    { key: 'relation_threshold', label: 'Relation threshold', defaultValue: 0.58, range: '0–1', purpose: 'Initial relation acceptance.' },
    { key: 'entity_resolution_threshold', label: 'Resolution threshold', defaultValue: 0.78, range: '0–1', purpose: 'Controls entity merging.' },
  ],
  Fuzzy: [
    { key: 'membership_centres', label: 'Membership centres', defaultValue: '0.2, 0.5, 0.8', range: '0–1', purpose: 'Positions linguistic sets.' },
    { key: 'membership_widths', label: 'Membership widths', defaultValue: '0.18, 0.22, 0.18', range: '0.01–1', purpose: 'Controls ambiguity overlap.' },
    { key: 'rule_weight', label: 'Rule weight', defaultValue: 0.9, range: '0–1', purpose: 'Scales fuzzy rule influence.' },
    { key: 'inference_method', label: 'Inference method', defaultValue: 'Mamdani', range: 'Mamdani | Sugeno', purpose: 'Chooses reasoning strategy.' },
  ],
  GA: [
    { key: 'population_size', label: 'Population size', defaultValue: 36, range: '8–200', purpose: 'Candidate configurations per generation.' },
    { key: 'generations', label: 'Generations', defaultValue: 60, range: '5–500', purpose: 'Evolution budget.' },
    { key: 'mutation_rate', label: 'Mutation rate', defaultValue: 0.08, range: '0–0.5', purpose: 'Maintains genetic diversity.' },
    { key: 'crossover_rate', label: 'Crossover rate', defaultValue: 0.82, range: '0–1', purpose: 'Controls recombination.' },
    { key: 'elitism', label: 'Elitism', defaultValue: 2, range: '0–10', purpose: 'Preserves top chromosomes.' },
  ],
  PSO: [
    { key: 'particle_count', label: 'Particle count', defaultValue: 30, range: '5–200', purpose: 'Swarm size.' },
    { key: 'inertia_weight', label: 'Inertia weight', defaultValue: 0.72, range: '0–1.2', purpose: 'Balances momentum and convergence.' },
    { key: 'cognitive_coefficient', label: 'Cognitive coefficient', defaultValue: 1.45, range: '0–3', purpose: 'Pull toward personal best.' },
    { key: 'social_coefficient', label: 'Social coefficient', defaultValue: 1.55, range: '0–3', purpose: 'Pull toward global best.' },
  ],
  ACO: [
    { key: 'ant_count', label: 'Ant count', defaultValue: 24, range: '5–200', purpose: 'Parallel graph-search agents.' },
    { key: 'pheromone_importance', label: 'Pheromone importance', defaultValue: 1.2, range: '0–5', purpose: 'Uses path history.' },
    { key: 'heuristic_importance', label: 'Heuristic importance', defaultValue: 2.0, range: '0–5', purpose: 'Uses semantic desirability.' },
    { key: 'evaporation_rate', label: 'Evaporation rate', defaultValue: 0.28, range: '0–1', purpose: 'Prevents premature path lock-in.' },
    { key: 'max_hops', label: 'Maximum hops', defaultValue: 4, range: '1–8', purpose: 'Limits reasoning depth.' },
  ],
  GWO: [
    { key: 'wolf_count', label: 'Wolf count', defaultValue: 24, range: '5–100', purpose: 'Candidate subgraph leaders.' },
    { key: 'exploration_coefficient', label: 'Exploration coefficient', defaultValue: 1.6, range: '0–2', purpose: 'Transitions from search to encircling.' },
  ],
  WOA: [
    { key: 'whale_count', label: 'Whale count', defaultValue: 26, range: '5–100', purpose: 'Candidate configurations.' },
    { key: 'spiral_constant', label: 'Spiral constant', defaultValue: 1.0, range: '0.1–3', purpose: 'Shapes spiral exploitation.' },
  ],
  Retrieval: [
    { key: 'semantic_weight', label: 'Semantic weight', defaultValue: 0.26, range: '0–1', purpose: 'Embedding similarity contribution.' },
    { key: 'graph_weight', label: 'Graph weight', defaultValue: 0.18, range: '0–1', purpose: 'Topology contribution.' },
    { key: 'fuzzy_weight', label: 'Fuzzy weight', defaultValue: 0.2, range: '0–1', purpose: 'Uncertainty-aware relevance.' },
    { key: 'centrality_weight', label: 'Centrality weight', defaultValue: 0.09, range: '0–1', purpose: 'Entity importance contribution.' },
    { key: 'source_weight', label: 'Source weight', defaultValue: 0.1, range: '0–1', purpose: 'Evidence reliability contribution.' },
    { key: 'temporal_weight', label: 'Temporal weight', defaultValue: 0.05, range: '0–1', purpose: 'Recency contribution.' },
    { key: 'path_weight', label: 'ACO path weight', defaultValue: 0.12, range: '0–1', purpose: 'Reasoning-path quality.' },
    { key: 'top_k', label: 'Top K', defaultValue: 5, range: '1–50', purpose: 'Ranked evidence count.' },
  ],
};

export const retrievalWeights = {
  semantic: 0.26,
  graph: 0.18,
  fuzzy: 0.2,
  centrality: 0.09,
  source: 0.1,
  temporal: 0.05,
  path: 0.12,
} as const;
