'use client';
import { useEffect, useState } from 'react';
import Link from '@/components/common/app-link';
import { serviceMode, services } from '@/services';
import { ApiClient, resolveApiBaseUrl } from '@/services/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MetricCard } from '@/components/common/metric-card';
interface Snapshot {
  documents: number;
  pending: number;
  failed: number;
  entities: number;
  relations: number;
  version: string;
}
export function SystemSnapshot() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(serviceMode === 'api');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (serviceMode !== 'api') return;
    let active = true;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError('');
      setSnapshot(null);
      try {
        const client = new ApiClient({
          baseUrl: resolveApiBaseUrl().replace(/\/api$/, ''),
        });
        const [health, graph, jobs] = await Promise.all([
          client.get<{ status: string }>('/health', controller.signal),
          services.graph.getGraph(controller.signal),
          services.ingestion.listJobs?.() ?? Promise.resolve([]),
        ]);
        if (health.status !== 'healthy')
          throw new Error('Backend health check did not report healthy.');
        if (active)
          setSnapshot({
            documents: new Set(
              jobs
                .filter((job) => job.status === 'completed')
                .map((job) => job.documentId),
            ).size,
            pending: jobs.filter(
              (job) => !['completed', 'failed'].includes(job.status),
            ).length,
            failed: jobs.filter((job) => job.status === 'failed').length,
            entities: graph.entities.length,
            relations: graph.relations.length,
            version: graph.graphVersion ?? 'unknown',
          });
      } catch (caught) {
        if (active)
          setError(
            caught instanceof Error ? caught.message : 'Backend unavailable',
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    const interval = setInterval(() => {
      void load();
    }, 30000);
    return () => {
      active = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [revision]);
  return (
    <section aria-labelledby="system-snapshot">
      <Card className="border-slate-200 p-5 shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="system-snapshot" className="text-xl font-semibold">
            Knowledge graph at a glance
          </h2>
          {serviceMode === 'api' && (
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => setRevision((value) => value + 1)}
            >
              Refresh status
            </Button>
          )}
        </div>
        <output aria-live="polite" className="text-sm">
          {serviceMode === 'mock'
            ? 'Mock mode: deterministic teaching graph; no backend connection checked.'
            : loading
              ? 'Checking backend and stored data…'
              : error
                ? `Backend unavailable: ${error}`
                : `Backend ready · ${snapshot?.version ?? 'unknown'} · checked every 30 seconds`}
        </output>
        {serviceMode === 'mock' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Demo entities" value="42" note="simulated" />
            <MetricCard label="Demo relations" value="78" note="simulated" />
          </div>
        )}
        {snapshot && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Completed recent sources"
              value={String(snapshot.documents)}
              note="latest 20 jobs"
            />
            <MetricCard
              label="Entities"
              value={String(snapshot.entities)}
              note="saved graph"
            />
            <MetricCard
              label="Relations"
              value={String(snapshot.relations)}
              note="saved graph"
            />
            <MetricCard
              label="Recent pending / failed jobs"
              value={`${snapshot.pending} / ${snapshot.failed}`}
              note="latest 20 jobs"
            />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Source and job counts cover the latest 20 jobs; graph counts cover the
          full saved graph. Counts are not measured retrieval quality.
          Extraction and ranking scores are untrained heuristics.
        </p>
        <nav
          aria-label="Document workflow"
          className="flex flex-wrap gap-4 text-sm font-semibold"
        >
          <Link href="/ingestion" className="underline">
            1. Ingest a document
          </Link>
          <Link href="/graph" className="underline">
            2. Build and inspect the graph
          </Link>
          <Link href="/retrieval" className="underline">
            3. Retrieve cited evidence
          </Link>
        </nav>
      </Card>
    </section>
  );
}
