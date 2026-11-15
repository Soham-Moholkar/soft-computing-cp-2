'use client';
import { useEffect, useState } from 'react';
import { ApiClient } from '@/services/api/client';
import type { OptimizationJob } from '@/services/api/optimization-service';

interface Report {
  id: string;
  dataset_version: string;
  review_status: string;
  domain: string;
  split: string;
  code_sha256: string;
  source_count: number;
  top_k: number;
  limitations: string[];
  summary: Record<
    string,
    {
      queries: number;
      answerable_response_with_relevant_evidence_rate: number | null;
      no_answer_abstention_rate: number | null;
      latency_p95_ms: number;
      retrieval: {
        mrr_at_k: {
          mean: number;
          bootstrap_95_ci: number[] | null;
          families: number;
        };
        ndcg_at_k: { mean: number };
      };
    }
  >;
}
export function EvaluationDashboard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [runs, setRuns] = useState<OptimizationJob[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void new ApiClient()
      .get<{ reports: Report[]; optimizer_runs: OptimizationJob[] }>(
        '/benchmark',
        controller.signal,
      )
      .then((response) => {
        setReports(response.reports);
        setRuns(response.optimizer_runs);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error ? cause.message : 'Could not load reports.',
          );
      });
    return () => controller.abort();
  }, []);
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">
          Evidence, not demo scores
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Evaluation reports
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Versioned offline results. Each collection has its own domain and
          annotation limits; these scores do not establish production readiness.
        </p>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {reports.map((report) => (
        <section
          key={report.id}
          className="overflow-hidden rounded-2xl border bg-white"
        >
          <div className="border-b p-5">
            <h2 className="font-semibold">{report.dataset_version}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {report.id} · {report.review_status} · {report.domain} ·{' '}
              {report.split} · K={report.top_k} · {report.source_count} sources
            </p>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-muted-foreground">
                <tr>
                  {[
                    'Mode',
                    'Questions',
                    'MRR',
                    'NDCG',
                    'Relevant response',
                    'No-answer abstention',
                    'Warm p95',
                    'MRR family interval',
                  ].map((label) => (
                    <th
                      key={label}
                      className="whitespace-nowrap px-5 py-3 font-medium"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(report.summary).map(([mode, data]) => (
                  <tr key={mode} className="border-t">
                    <td className="px-5 py-4 font-medium">{mode}</td>
                    <td className="px-5">{data.queries}</td>
                    <td className="px-5 font-mono">
                      {data.retrieval.mrr_at_k.mean.toFixed(3)}
                    </td>
                    <td className="px-5 font-mono">
                      {data.retrieval.ndcg_at_k.mean.toFixed(3)}
                    </td>
                    <td className="px-5">
                      {data.answerable_response_with_relevant_evidence_rate ==
                      null
                        ? 'Unavailable'
                        : `${(data.answerable_response_with_relevant_evidence_rate * 100).toFixed(1)}%`}
                    </td>
                    <td className="px-5">
                      {data.no_answer_abstention_rate == null
                        ? 'No labels'
                        : `${(data.no_answer_abstention_rate * 100).toFixed(1)}%`}
                    </td>
                    <td className="whitespace-nowrap px-5">
                      {data.latency_p95_ms.toFixed(1)} ms
                    </td>
                    <td className="whitespace-nowrap px-5">
                      {data.retrieval.mrr_at_k.bootstrap_95_ci
                        ?.map((v) => v.toFixed(3))
                        .join('–') ?? 'Withheld'}{' '}
                      · {data.retrieval.mrr_at_k.families} families
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t p-5 text-xs leading-5 text-muted-foreground">
            Code snapshot {report.code_sha256.slice(0, 16)} ·{' '}
            {report.limitations[0]}
          </p>
        </section>
      ))}
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="font-semibold">Saved optimizer results</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Compare runs only with matching dataset hashes, budgets and settings.
          Baseline latency penalties are fixed; these are candidate-bank ranking
          results.
        </p>
        <div className="mt-4 divide-y">
          {runs
            .filter((run) => run.result)
            .map((run) => (
              <div
                className="flex flex-wrap justify-between gap-2 py-3 text-sm"
                key={run.job_id}
              >
                <span>
                  {run.request.algorithm} · {run.request.dataset} · seed{' '}
                  {run.request.seed} ·{' '}
                  {run.result!.evaluations ?? run.result!.training_steps}{' '}
                  evaluations/updates
                </span>
                <span className="font-mono">
                  NDCG {run.result!.best_metrics.ndcg_at_k.toFixed(3)} ·
                  candidate
                </span>
              </div>
            ))}
          {runs.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">
              Run an experiment in the optimization studio to add results.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
