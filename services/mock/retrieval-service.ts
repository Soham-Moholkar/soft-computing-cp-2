import { graphData } from '../../data/graph.js';
import { calculateHybridScore } from '../../lib/algorithms/retrieval.js';
import { evaluateRetrievalFuzzy } from '../../lib/algorithms/fuzzy.js';
import { retrievalWeights } from '../../lib/parameters.js';
import type { RetrievalService } from '../contracts.js';

export const mockRetrievalService: RetrievalService = {
  async retrieve(request) {
    // TODO(PASS-2): Replace with POST /api/retrieve or /api/hybrid/retrieve from docs/API_CONTRACTS.md.
    const modeBoost = { lexical: 0, semantic: 0, graph: 0.02, fuzzy: 0.03, aco: 0.04, hybrid: 0.06 }[request.mode];
    const signals = {
      semantic: 0.9,
      graph: 0.84,
      fuzzy: 0.88,
      centrality: 0.76,
      source: 0.92,
      temporal: 0.72,
      path: 0.89,
    };
    const scored = calculateHybridScore(signals, retrievalWeights);
    const confidence = Math.min(0.97, scored.score + modeBoost);
    const nodeIds = new Set(['e07', 'e28', 'e25', 'e42', 'e04', 'e08', 'e17']);
    const nodes = graphData.entities.filter((entity) => nodeIds.has(entity.entityId));
    const relations = graphData.relations.filter((relation) => nodeIds.has(relation.sourceEntity) && nodeIds.has(relation.targetEntity));
    const fuzzyExplanation = evaluateRetrievalFuzzy({
      semanticSimilarity: signals.semantic,
      relationStrength: signals.fuzzy,
      graphDistance: 2,
      inferenceMethod: 'mamdani',
      defuzzificationMethod: 'centroid',
    });
    return {
      answer:
        'Particle Swarm Optimization improves knowledge-graph retrieval by tuning the weights that combine semantic similarity, graph topology, fuzzy confidence and node importance. ACO complements PSO by exploring multi-hop paths, while PSO refines the ranking configuration used to score their evidence.',
      confidence,
      mode: request.mode,
      nodes,
      relations,
      evidence: [
        { chunkId: 'chunk-04', text: 'A particle encodes semantic, fuzzy, graph, centrality, recency and source weights.', source: 'Swarm Optimization Notes.pdf', reliability: 0.94 },
        { chunkId: 'chunk-07', text: 'The global best position becomes the current high-performing retrieval configuration.', source: 'SoftGraph Architecture.md', reliability: 0.91 },
        { chunkId: 'chunk-02', text: 'ACO supplies candidate paths that are ranked by the hybrid relevance model.', source: 'Knowledge Graph Retrieval.txt', reliability: 0.88 },
      ].slice(0, Math.min(3, request.topK)),
      paths: [
        { labels: ['Particle Swarm Optimization', 'Retrieval Relevance', 'Knowledge Graph'], score: 0.91, pheromone: 0.88 },
        { labels: ['Particle Swarm Optimization', 'Optimization', 'Machine Learning', 'Knowledge Graph'], score: 0.84, pheromone: 0.73 },
      ],
      scoreBreakdown: scored.breakdown,
      fuzzyExplanation,
      timeline: [
        { stage: 'Query understanding', durationMs: 34, status: 'complete' },
        { stage: 'Seed entity retrieval', durationMs: 42, status: 'complete' },
        { stage: 'Semantic search', durationMs: 57, status: 'complete' },
        { stage: 'ACO traversal', durationMs: 68, status: 'complete' },
        { stage: 'Fuzzy inference', durationMs: 26, status: 'complete' },
        { stage: 'Hybrid ranking', durationMs: 19, status: 'complete' },
      ],
    };
  },
};
