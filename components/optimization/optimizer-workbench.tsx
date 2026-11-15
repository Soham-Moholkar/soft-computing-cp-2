'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Play, FlaskConical, Route, RefreshCw } from 'lucide-react';
import { ApiClient } from '@/services/api/client';
import {
  waitForOptimization,
  type OptimizationJob,
  type SearchAlgorithm,
} from '@/services/api/optimization-service';
import { ConvergenceChart } from '@/components/charts/convergence-chart';

const algorithms: SearchAlgorithm[] = [
  'GA',
  'PSO',
  'GWO',
  'WOA',
  'FUZZY_GA',
  'GA_PSO',
  'NEURO_FUZZY',
];
const client = new ApiClient();
interface AntResult {
  paths: Array<{
    labels: string[];
    score: number;
    pheromone: number;
    source_chunks: string[];
  }>;
  evaluations: number;
  graph_version: string;
  limitations: string;
}

export function OptimizerWorkbench({
  initialAlgorithm = 'GA',
}: {
  initialAlgorithm?: SearchAlgorithm;
}) {
  const [algorithm, setAlgorithm] = useState<SearchAlgorithm>(initialAlgorithm);
  const [dataset, setDataset] = useState<'synthetic' | 'real'>('synthetic');
  const [budget, setBudget] = useState(64);
  const [seed, setSeed] = useState(17);
  const [jobs, setJobs] = useState<OptimizationJob[]>([]);
  const [job, setJob] = useState<OptimizationJob | null>(null);
  const [nodes, setNodes] = useState<
    Array<{ entity_id: string; canonical_name: string }>
  >([]);
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [ants, setAnts] = useState<AntResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      client.get<OptimizationJob[]>('/optimization/jobs', controller.signal),
      client.get<{ entities: typeof nodes }>(
        '/graph?limit=500',
        controller.signal,
      ),
    ])
      .then(([saved, graph]) => {
        if (!controller.signal.aborted) {
          setJobs(saved);
          setNodes(graph.entities);
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error ? cause.message : 'Could not load runs.',
          );
      });
    return () => {
      controller.abort();
      active.current?.abort();
    };
  }, []);
  async function run() {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError('');
    try {
      const accepted = await client.post<OptimizationJob>(
        '/optimization/jobs',
        {
          algorithm,
          dataset,
          evaluation_budget: budget,
          population_size: 8,
          seed,
        },
        controller.signal,
      );
      setJob(accepted);
      const completed = await waitForOptimization(
        client,
        accepted,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setJob(completed);
      setJobs(
        await client.get<OptimizationJob[]>(
          '/optimization/jobs',
          controller.signal,
        ),
      );
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : 'Run failed.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  async function explore() {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError('');
    try {
      const result = await client.post<AntResult>(
        '/aco/search',
        { source_entity: source, target_entity: target, seed, max_hops: 5 },
        controller.signal,
      );
      if (!controller.signal.aborted) setAnts(result);
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error ? cause.message : 'Path search failed.',
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  async function reopen(saved: OptimizationJob) {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError('');
    setJob(saved);
    setAlgorithm(saved.request.algorithm);
    setDataset(saved.request.dataset);
    setBudget(saved.request.evaluation_budget);
    setSeed(saved.request.seed);
    try {
      const result = await waitForOptimization(
        client,
        saved,
        controller.signal,
      );
      if (!controller.signal.aborted) setJob(result);
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error ? cause.message : 'Could not reopen run.',
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  function download() {
    if (!job?.artifact) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(job.artifact, null, 2)], {
        type: 'application/json',
      }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${job.job_id}-candidate.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  const result = job?.result;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">
            Measured experiments
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Optimization studio
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Run real searches against held-out candidate features. Every
            evaluation is recorded; exported candidates require separate
            end-to-end evaluation and promotion.
          </p>
        </div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-900">
          Diagnostics · no live promotion
        </span>
      </div>
      <section className="grid gap-6 xl:grid-cols-[300px_1fr]">
        <div className="rounded-2xl border bg-white p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <FlaskConical className="size-4" /> Experiment settings
          </h2>
          <div className="mt-5 space-y-4">
            <label className="block text-xs font-medium">
              Algorithm
              <select
                className="mt-2 w-full rounded-lg border p-2 text-sm"
                value={algorithm}
                disabled={busy}
                onChange={(event) => {
                  const value = event.target.value as SearchAlgorithm;
                  setAlgorithm(value);
                  if (value === 'NEURO_FUZZY') setDataset('real');
                }}
              >
                {algorithms.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium">
              Evaluation collection
              <select
                className="mt-2 w-full rounded-lg border p-2 text-sm"
                value={dataset}
                disabled={busy || algorithm === 'NEURO_FUZZY'}
                onChange={(event) =>
                  setDataset(event.target.value as typeof dataset)
                }
              >
                <option value="synthetic">Hard synthetic course cases</option>
                <option value="real">Human-authored Wikipedia questions</option>
              </select>
            </label>
            <label className="block text-xs font-medium">
              {algorithm === 'NEURO_FUZZY'
                ? 'Training updates'
                : 'Fitness evaluations'}
              <select
                className="mt-2 w-full rounded-lg border p-2 text-sm"
                value={budget}
                disabled={busy}
                onChange={(event) => setBudget(Number(event.target.value))}
              >
                {[16, 32, 64, 128, 256].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium">
              Random seed
              <input
                type="number"
                min={0}
                max={2147483647}
                className="mt-2 w-full rounded-lg border p-2 text-sm"
                value={seed}
                disabled={busy}
                onChange={(event) => setSeed(Number(event.target.value))}
              />
            </label>
            <button
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
              disabled={busy}
              onClick={() => void run()}
            >
              <Play className="size-4" />
              {busy ? 'Processing run…' : 'Run experiment'}
            </button>
            <p className="text-xs leading-5 text-muted-foreground">
              Default population: 8. Latency and graph-noise penalties use fixed
              measured baseline values. They do not measure a new candidate’s
              response latency.
            </p>
          </div>
        </div>
        <div className="min-w-0 rounded-2xl border bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">
              {(result?.algorithm ?? algorithm) === 'NEURO_FUZZY'
                ? 'Train-only learning trace'
                : 'Best fitness by evaluation'}
            </h2>
            {job?.artifact && (
              <button
                onClick={download}
                className="flex items-center gap-2 text-xs font-medium text-teal-700"
              >
                <Download className="size-4" /> Export candidate
              </button>
            )}
          </div>
          {result ? (
            <>
              <p className="mt-3 text-xs text-muted-foreground">
                Recorded run: {result.algorithm} · {job.request.dataset} · seed{' '}
                {job.request.seed} · budget {job.request.evaluation_budget}
              </p>
              <ConvergenceChart
                xLabel={
                  result.algorithm === 'NEURO_FUZZY'
                    ? 'training update'
                    : 'evaluation'
                }
                label={
                  result.algorithm === 'NEURO_FUZZY'
                    ? 'Train pairwise loss'
                    : 'Best fitness'
                }
                data={result.trace.map((point, index) => ({
                  iteration: point.evaluation ?? point.step ?? index + 1,
                  fitness: point.best_fitness ?? point.train_pairwise_loss ?? 0,
                }))}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ['NDCG@K', result.best_metrics.ndcg_at_k.toFixed(3)],
                  ['Recall@K', result.best_metrics.recall_at_k.toFixed(3)],
                  [
                    'Recorded evaluations / updates',
                    String(result.evaluations ?? result.training_steps),
                  ],
                ].map(([label, value]) => (
                  <div className="rounded-xl bg-slate-50 p-4" key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-2 font-mono text-xl">{value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Weights / consequents:{' '}
                {result.best_vector
                  .map((value) => value.toFixed(3))
                  .join(' · ')}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {result.provenance.dataset_version} ·{' '}
                {result.provenance.review_status} · {result.provenance.domain}
              </p>
              {result.algorithm === 'NEURO_FUZZY' && (
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  {result.training_pairs} train-only preference pairs. This
                  experiment learns nine Sugeno consequents with fixed
                  memberships; it is not a full ANFIS premise optimizer. The
                  Wikipedia adaptation is not a reviewed course corpus.
                </p>
              )}
            </>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-muted-foreground">
              <FlaskConical className="size-8" />
              <p className="text-sm">
                {job
                  ? `Run ${job.status}. The backend keeps processing if you leave.`
                  : 'Choose an algorithm and run a recorded experiment.'}
              </p>
            </div>
          )}
        </div>
      </section>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Route className="size-4" /> Ant-colony path search
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Searches your actual built graph. Pheromone evolves from successful
          ants; paths cite stored chunks.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <label className="min-w-52 flex-1 text-xs">
            From
            <select
              className="mt-1 w-full rounded-lg border p-2"
              value={source}
              onChange={(event) => setSource(event.target.value)}
            >
              <option value="">Select source concept</option>
              {nodes.map((node) => (
                <option key={node.entity_id} value={node.entity_id}>
                  {node.canonical_name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-52 flex-1 text-xs">
            To
            <select
              className="mt-1 w-full rounded-lg border p-2"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            >
              <option value="">Select target concept</option>
              {nodes.map((node) => (
                <option key={node.entity_id} value={node.entity_id}>
                  {node.canonical_name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="self-end rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
            disabled={busy || !source || !target || source === target}
            onClick={() => void explore()}
          >
            Explore paths
          </button>
        </div>
        {ants && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              {ants.evaluations} ant evaluations · {ants.graph_version}
            </p>
            {ants.paths.map((path) => (
              <div
                key={path.labels.join('|')}
                className="rounded-lg bg-slate-50 p-3 text-sm"
              >
                <p>{path.labels.join(' → ')}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Strength {path.score.toFixed(2)} · pheromone{' '}
                  {path.pheromone.toFixed(3)} · {path.source_chunks.length}{' '}
                  source chunks
                </p>
              </div>
            ))}
            {!ants.paths.length && (
              <p className="text-sm">No path found within the search budget.</p>
            )}
          </div>
        )}
      </section>
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="font-semibold">Recent saved runs</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Latest 20 runs. Reopen a queued run after leaving the page.
        </p>
        <div className="mt-4 divide-y">
          {jobs.map((saved) => (
            <button
              className="flex w-full flex-wrap items-center justify-between gap-2 py-3 text-left text-sm"
              key={saved.job_id}
              disabled={busy}
              onClick={() => void reopen(saved)}
            >
              <span>
                {saved.request.algorithm} · {saved.request.dataset} · seed{' '}
                {saved.request.seed}
              </span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {saved.status}
                <RefreshCw className="size-3" />
              </span>
            </button>
          ))}
          {jobs.length === 0 && (
            <p className="py-5 text-sm text-muted-foreground">
              No saved runs yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
