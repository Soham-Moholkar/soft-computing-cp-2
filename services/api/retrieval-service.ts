import type { RetrievalRequest, RetrievalResult } from '../../lib/types.js';
import type { ExplanationService, HybridService, RetrievalService } from '../contracts.js';
import { ApiClient } from './client.js';
import { mapFuzzyResult, type ApiFuzzyResult } from './fuzzy-service.js';
import { mapGraphResponse, type ApiGraphResponse } from './graph-service.js';

export interface ApiRetrievalResult {
  result_id: string;
  query: string;
  answer: string;
  answer_status: 'evidence' | 'insufficient_evidence';
  confidence: number;
  confidence_label: string;
  mode: RetrievalResult['mode'];
  nodes: ApiGraphResponse['entities'];
  relations: ApiGraphResponse['relations'];
  graph_version: string;
  index_version: string;
  configuration_version: string;
  provider_status: string;
  warnings: string[];
  evidence: Array<{ citation: number; chunk_id: string; document_id: string; document_name: string; text: string; excerpt: string; source_location: Record<string, string | number>; rank_score: number }>;
  paths: Array<{ labels: string[]; score: number; relation_ids: string[]; citation_ids: number[]; traversal: string }>;
  score_breakdown: Array<{ component: string; raw_score: number; weight: number; contribution: number }>;
  fuzzy_explanation: ApiFuzzyResult;
  timeline: Array<{ stage: string; duration_ms: number; status: 'complete' }>;
}

export function mapRetrievalResult(response: ApiRetrievalResult): RetrievalResult {
  const graph = mapGraphResponse({ entities: response.nodes, relations: response.relations, graph_version: response.graph_version, next_cursor: null });
  return {
    resultId: response.result_id, query: response.query, answer: response.answer, answerStatus: response.answer_status,
    confidence: response.confidence, confidenceLabel: response.confidence_label, mode: response.mode,
    nodes: graph.entities, relations: graph.relations, graphVersion: response.graph_version,
    indexVersion: response.index_version, configurationVersion: response.configuration_version,
    providerStatus: response.provider_status, warnings: response.warnings,
    evidence: response.evidence.map((item) => ({ citation: item.citation, chunkId: item.chunk_id, documentId: item.document_id, text: item.text, excerpt: item.excerpt, source: item.document_name, sourceLocation: item.source_location, reliability: null, rankScore: item.rank_score })),
    paths: response.paths.map((item) => ({ labels: item.labels, score: item.score, relationIds: item.relation_ids, citationIds: item.citation_ids, traversal: item.traversal })),
    scoreBreakdown: response.score_breakdown.map((item) => ({ component: item.component, rawScore: item.raw_score, weight: item.weight, contribution: item.contribution })),
    fuzzyExplanation: mapFuzzyResult(response.fuzzy_explanation),
    timeline: response.timeline.map((item) => ({ stage: item.stage, durationMs: item.duration_ms, status: item.status })),
  };
}

export function createRestRetrievalService(client = new ApiClient()): RetrievalService & HybridService {
  return {
    async retrieve(request: RetrievalRequest) {
      const response = await client.post<ApiRetrievalResult>('/retrieve', {
        query: request.query, mode: request.mode, top_k: request.topK, max_hops: request.maxHops,
        use_provider: request.useProvider ?? false,
        ...(request.documentId ? { document_id: request.documentId } : {}),
        ...(request.rankingProfile ? { ranking_profile: request.rankingProfile } : {}),
      }, request.signal);
      return mapRetrievalResult(response);
    },
    async getResult(resultId, signal) {
      return mapRetrievalResult(await client.get<ApiRetrievalResult>(`/retrieval/results/${encodeURIComponent(resultId)}`, signal));
    },
    async submitFeedback(feedback, resultId) {
      if (!resultId) throw new Error('Retrieve a saved result before submitting feedback.');
      return client.post<{ accepted: true; message: string }>('/hybrid/feedback', { result_id: resultId, feedback });
    },
  };
}

export function createRestExplanationService(client = new ApiClient()): ExplanationService {
  return {
    async explain(result) {
      if (!result.resultId) throw new Error('This result has no saved explanation. Retrieve a new result.');
      const response = await client.post<{ headline: string; decision_trace: string[]; alternatives: Array<{ path: string; confidence: number }> }>('/explanations', { result_id: result.resultId });
      return { headline: response.headline, decisionTrace: response.decision_trace, alternatives: response.alternatives };
    },
  };
}
