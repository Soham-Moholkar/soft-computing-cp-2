import type { BenchmarkService } from '../contracts.js';
import { ApiClient } from './client.js';

export function createRestBenchmarkService(client = new ApiClient()): BenchmarkService {
  return { async getResults() {
    const response = await client.get<{ reports: Array<{ id: string; extraction: { end_to_end_resolution_accuracy: number | null; relations: { precision: number | null; tp: number; fp: number } } | null; summary: Record<string, { retrieval: Record<string, { mean: number }>; latency_p95_ms: number }> }> }>('/benchmark');
    return response.reports.flatMap((report) => Object.entries(report.summary).map(([mode, metrics]) => ({
      system: `${report.id} / ${mode}`, precisionAtK: metrics.retrieval.precision_at_k.mean,
      recallAtK: metrics.retrieval.recall_at_k.mean, f1: metrics.retrieval.f1_at_k.mean,
      mrr: metrics.retrieval.mrr_at_k.mean, ndcg: metrics.retrieval.ndcg_at_k.mean,
      latencyMs: metrics.latency_p95_ms, entityResolutionAccuracy: report.extraction?.end_to_end_resolution_accuracy ?? null,
      relationAccuracy: report.extraction?.relations.precision ?? null,
      graphNoiseRatio: report.extraction ? report.extraction.relations.fp / Math.max(1, report.extraction.relations.fp + report.extraction.relations.tp) : null,
    })));
  } };
}
