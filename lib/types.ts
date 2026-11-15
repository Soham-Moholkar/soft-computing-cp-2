export type SourceType = 'txt' | 'pdf' | 'docx' | 'csv' | 'json' | 'paste' | 'url' | 'sample';
export type EntityType =
  | 'Concept'
  | 'Technology'
  | 'Process'
  | 'Domain'
  | 'Organization'
  | 'Person'
  | 'Location'
  | 'Event'
  | 'Document'
  | 'Product';

export interface DocumentRecord {
  documentId: string;
  name: string;
  sourceType: SourceType;
  sourceUri?: string;
  domain: string;
  timestamp: string;
  metadata: Record<string, string | number | boolean>;
  processingStatus: 'uploaded' | 'parsing' | 'chunking' | 'extracting' | 'resolving' | 'building' | 'completed' | 'failed';
}

export interface Chunk {
  chunkId: string;
  documentId: string;
  text: string;
  sequence: number;
  tokenCount: number;
  embeddingReference: string;
  importanceScore: number;
}

export interface Entity {
  entityId: string;
  canonicalName: string;
  entityType: EntityType;
  aliases: string[];
  description: string;
  sourceChunks: string[];
  extractionConfidence: number;
  fuzzyConfidence: number;
  centralityScore: number;
  importanceScore: number;
  embeddingReference: string;
  x: number;
  y: number;
}

export interface Relation {
  relationId: string;
  sourceEntity: string;
  targetEntity: string;
  relationType: string;
  evidence: string;
  sourceChunk: string;
  extractionConfidence: number;
  fuzzyStrength: number;
  semanticStrength: number;
  temporalStrength: number;
  finalWeight: number;
}

export interface GraphData {
  graphVersion?: string;
  entities: Entity[];
  relations: Relation[];
}

export interface FuzzyRule {
  id: string;
  antecedent: string;
  consequent: string;
  weight: number;
  enabled: boolean;
}

export interface FuzzyEvaluationInput {
  semanticSimilarity: number;
  relationStrength: number;
  graphDistance: number;
  inferenceMethod: 'mamdani' | 'sugeno';
  defuzzificationMethod: 'centroid' | 'bisector' | 'mean-of-maxima';
  signal?: AbortSignal;
}

export interface FuzzyEvaluationResult {
  score: number;
  label: 'Irrelevant' | 'Possible' | 'Relevant' | 'Highly relevant';
  memberships: Record<string, number>;
  ruleFirings: Array<{
    ruleId: string;
    rule: string;
    strength: number;
    antecedentMemberships: Record<string, number>;
    unweightedFiring: number;
    weight: number;
    weightedFiring: number;
    consequent: string;
  }>;
  controllerDecision: 'Reject' | 'Review' | 'Accept weakly' | 'Accept strongly';
  aggregatedOutput: Array<{ x: number; membership: number }>;
  variableSetVersion: string;
  ruleSetVersion: string;
  defuzzificationApplied: boolean;
  inferenceMethod: FuzzyEvaluationInput['inferenceMethod'];
  defuzzificationMethod: FuzzyEvaluationInput['defuzzificationMethod'];
}

export interface OptimizerConfig {
  populationSize: number;
  iterations: number;
  mutationRate: number;
  crossoverRate: number;
  selection: 'roulette' | 'tournament';
  encoding: 'binary' | 'real';
}

export interface OptimizerRun {
  algorithm: 'GA' | 'PSO' | 'ACO' | 'GWO' | 'WOA';
  convergence: Array<{ iteration: number; fitness: number }>;
  bestFitness: number;
  bestVector: number[];
  executionTimeMs: number;
}

export type RetrievalMode = 'lexical' | 'semantic' | 'graph' | 'fuzzy' | 'aco' | 'hybrid';

export interface RetrievalRequest {
  query: string;
  documentId?: string;
  rankingProfile?: 'balanced' | 'domain';
  mode: RetrievalMode;
  topK: number;
  maxHops: number;
  useProvider?: boolean;
  signal?: AbortSignal;
}

export interface ScoreContribution {
  component: string;
  rawScore: number;
  weight: number;
  contribution: number;
}

export interface RetrievalResult {
  resultId?: string;
  query?: string;
  answerStatus?: 'evidence' | 'insufficient_evidence';
  confidenceLabel?: string;
  graphVersion?: string;
  indexVersion?: string;
  configurationVersion?: string;
  providerStatus?: string;
  warnings?: string[];
  answer: string;
  confidence: number;
  mode: RetrievalMode;
  nodes: Entity[];
  relations: Relation[];
  evidence: Array<{ chunkId: string; text: string; source: string; reliability: number | null; citation?: number; documentId?: string; sourceLocation?: Record<string, string | number>; excerpt?: string; rankScore?: number }>;
  paths: Array<{ labels: string[]; score: number; pheromone?: number; relationIds?: string[]; citationIds?: number[]; traversal?: string }>;
  scoreBreakdown: ScoreContribution[];
  fuzzyExplanation: FuzzyEvaluationResult;
  timeline: Array<{ stage: string; durationMs: number; status: 'complete' }>;
}

export interface BenchmarkResult {
  system: string;
  precisionAtK: number;
  recallAtK: number;
  f1: number;
  mrr: number;
  ndcg: number;
  entityResolutionAccuracy: number | null;
  relationAccuracy: number | null;
  latencyMs: number;
  graphNoiseRatio: number | null;
}

export interface SyllabusEntry {
  unit: string;
  topic: string;
  concept: string;
  category: 'Foundations' | 'Fuzzy Logic' | 'Genetic Algorithms' | 'Swarm Intelligence' | 'Hybrid Systems' | 'Applications';
  whereUsed: string;
  whyUsed: string;
  input: string;
  output: string;
  parameters: string;
  equation: string;
  frontendDemo: string;
  futureBackend: string;
  evaluationMetric: string;
}
