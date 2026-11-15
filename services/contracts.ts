import type {
  BenchmarkResult,
  DocumentRecord,
  FuzzyEvaluationInput,
  FuzzyEvaluationResult,
  GraphData,
  OptimizerConfig,
  OptimizerRun,
  RetrievalRequest,
  RetrievalResult,
} from '../lib/types.js';

export interface IngestionProcessInput {
  name: string;
  sourceType: DocumentRecord['sourceType'];
  domain: string;
  text?: string;
  sourceUri?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  file?: File;
  onProgress?: (progress: IngestionProgress) => void;
  signal?: AbortSignal;
}

export interface IngestionProcessResult {
  document: DocumentRecord;
  stageDurations: Array<{ stage: string; durationMs: number }>;
  extractedEntities: number;
  extractedRelations: number;
  warnings: string[];
  jobId?: string;
  chunkCount?: number;
}

export interface IngestionProgress {
  jobId: string;
  documentId: string;
  status: DocumentRecord['processingStatus'];
  progress: number;
  stages: Array<{ stage: string; durationMs: number }>;
  error?: string;
}

export interface StoredDocument {
  documentId: string;
  name: string;
  totalChunks: number;
  nextOffset: number | null;
  chunks: Array<{ chunkId: string; text: string; tokenCount: number; sourceLocation: Record<string, string | number> }>;
}

export interface IngestionService {
  process(input: IngestionProcessInput): Promise<IngestionProcessResult>;
  listJobs?(): Promise<IngestionProgress[]>;
  getDocument?(documentId: string, offset?: number): Promise<StoredDocument>;
  resume?(jobId: string, onProgress?: IngestionProcessInput['onProgress'], signal?: AbortSignal): Promise<IngestionProgress>;
  retry?(jobId: string, onProgress?: IngestionProcessInput['onProgress'], signal?: AbortSignal): Promise<IngestionProgress>;
}

export interface GraphService {
  getGraph(signal?: AbortSignal): Promise<GraphData>;
  shortestPath(sourceId: string, targetId: string, options?: { minimumConfidence?: number; relationTypes?: string[] }): Promise<string[]>;
  build?(documentIds: string[], options?: { dryRun?: boolean; entityThreshold?: number; relationThreshold?: number }): Promise<GraphBuildSummary>;
  documents?(): Promise<GraphDocumentStatus[]>;
  extraction?(documentId: string): Promise<GraphExtraction>;
  entityDetail?(entityId: string): Promise<GraphEntityEvidence>;
  removeDocument?(documentId: string): Promise<void>;
}

export interface GraphBuildSummary {
  graphVersion: string;
  addedNodes: number;
  updatedNodes: number;
  removedNodes: number;
  addedRelations: number;
  updatedRelations: number;
  removedRelations: number;
  reviewCount: number;
  changed: boolean;
  dryRun: boolean;
  warnings: string[];
}

export interface GraphDocumentStatus {
  documentId: string;
  name: string;
  built: boolean;
  acceptedMentions: number;
  acceptedRelations: number;
  reviewCount: number;
}

export interface GraphExtraction {
  mentions: Array<{ surface: string; canonicalName: string; chunkId: string; start: number; end: number; confidence: number; accepted: boolean }>;
  candidates: Array<{ evidence: string; relationType: string; chunkId: string; confidence: number; accepted: boolean; reason: string }>;
}

export interface GraphEntityEvidence {
  canonicalName: string;
  graphVersion: string;
  evidence: Array<{ chunkId: string; documentId: string; documentName: string; text: string; location: Record<string, string | number> }>;
}

export interface FuzzyService {
  evaluate(input: FuzzyEvaluationInput): Promise<FuzzyEvaluationResult>;
}

export interface EvolutionaryService {
  optimize(config: OptimizerConfig): Promise<OptimizerRun>;
}

export interface SwarmService {
  optimize(algorithm: 'PSO' | 'GWO' | 'WOA', iterations: number): Promise<OptimizerRun>;
  searchGraph(query: string, maxHops: number): Promise<Array<{ labels: string[]; score: number; pheromone: number }>>;
}

export interface RetrievalService {
  retrieve(request: RetrievalRequest): Promise<RetrievalResult>;
  getResult?(resultId: string, signal?: AbortSignal): Promise<RetrievalResult>;
}

export interface HybridService {
  retrieve(request: RetrievalRequest): Promise<RetrievalResult>;
  submitFeedback(feedback: 'relevant' | 'partial' | 'irrelevant', resultId?: string): Promise<{ accepted: true; message: string }>;
}

export interface ExplanationService {
  explain(result: RetrievalResult): Promise<{
    headline: string;
    decisionTrace: string[];
    alternatives: Array<{ path: string; confidence: number }>;
  }>;
}

export interface BenchmarkService {
  getResults(): Promise<BenchmarkResult[]>;
}
