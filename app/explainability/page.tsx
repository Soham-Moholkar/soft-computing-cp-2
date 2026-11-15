'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from '@/components/common/app-link';
import { useSearchParams } from 'next/navigation';
import { Eye, LoaderCircle } from 'lucide-react';
import type { RetrievalResult } from '@/lib/types';
import { services, serviceMode } from '@/services';
import { ScoreBars } from '@/components/charts/score-bars';
import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

type Explanation = Awaited<ReturnType<typeof services.explanation.explain>>;

function ExplanationContent() {
  const params = useSearchParams();
  const resultId = params.get('result');
  return <ExplanationResult key={resultId ?? 'default'} resultId={resultId} />;
}

function ExplanationResult({ resultId }: { resultId: string | null }) {
  const [state, setState] = useState<{ result: RetrievalResult; explanation: Explanation } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    if (serviceMode === 'api' && !resultId) return () => controller.abort();
    async function load() {
      try {
        const result = resultId && services.retrieval.getResult
          ? await services.retrieval.getResult(resultId, controller.signal)
          : await services.hybrid.retrieve({ query: 'How is PSO related to Knowledge Graph?', mode: 'hybrid', topK: 5, maxHops: 4, signal: controller.signal });
        if (controller.signal.aborted) return;
        const explanation = await services.explanation.explain(result);
        if (!controller.signal.aborted) setState({ result, explanation });
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'The saved explanation could not be loaded.');
      }
    }
    void load();
    return () => controller.abort();
  }, [resultId]);

  if (error) return <Card className="p-6"><p role="alert" className="text-red-800">{error}</p><Link href="/retrieval" className="mt-4 inline-block text-primary underline">Retrieve a new result</Link></Card>;
  if (serviceMode === 'api' && !resultId) return <Card className="p-6"><h1 className="text-xl font-semibold">Explain a saved retrieval result</h1><p className="mt-3 text-sm text-muted-foreground">Run a question in the retrieval playground, then choose “Explain this saved result.” This page reads the original evidence and score snapshot.</p><Link href="/retrieval" className="mt-4 inline-block text-primary underline">Open retrieval playground</Link></Card>;
  if (!state) return <Card className="grid min-h-64 place-items-center"><LoaderCircle aria-label="Loading saved explanation" className="size-8 animate-spin text-primary" /></Card>;
  const { result, explanation } = state;
  const path = result.paths[0];

  return <>
    <PageHeader eyebrow="Unit VI · Explainable AI" title="Explainable retrieval dashboard" description="Inspect the source snapshot, ranking components and actual fuzzy rule firings behind this result." icon={Eye} />
    <Card className="border-emerald-200 bg-emerald-50 p-6 shadow-none">
      <Badge variant="outline">{result.answerStatus ?? 'demonstration'}</Badge>
      <h2 className="mt-3 text-xl font-semibold">{explanation.headline}</h2>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{result.answer}</p>
      <p className="mt-4 text-xs text-muted-foreground">{result.confidenceLabel ?? 'Demo confidence'}: {result.confidence.toFixed(4)}</p>
      <p className="mt-2 break-all text-xs text-muted-foreground">{result.resultId} · {result.graphVersion} · {result.indexVersion} · {result.configurationVersion}</p>
    </Card>
    <section className="grid gap-5 xl:grid-cols-3">
      <Card className="p-5 shadow-none"><h2 className="font-semibold">Membership values</h2><ScoreBars data={Object.entries(result.fuzzyExplanation.memberships).map(([name, value]) => ({ name: name.replaceAll('_', ' '), value }))} /></Card>
      <Card className="p-5 shadow-none"><h2 className="font-semibold">Score composition</h2><ScoreBars data={result.scoreBreakdown.map((item) => ({ name: item.component, value: item.contribution }))} domain={[0, 1]} color="#0891b2" /></Card>
      <Card className="p-5 shadow-none"><h2 className="font-semibold">Rule firings</h2><ScoreBars data={result.fuzzyExplanation.ruleFirings.map((item) => ({ name: item.ruleId, value: item.strength }))} domain={[0, 1]} color="#d97706" /><p className="text-xs text-muted-foreground">{result.fuzzyExplanation.ruleSetVersion} · {result.fuzzyExplanation.inferenceMethod}</p></Card>
    </section>
    <section className="grid gap-5 xl:grid-cols-2">
      <Card className="p-6 shadow-none"><h2 className="font-semibold">Graph path and edge direction</h2>
        {path ? <><p className="mt-4 text-sm font-medium">{path.labels.join(' → ')}</p><p className="mt-3 text-xs text-muted-foreground">{path.labels.length - 1} hops · minimum edge confidence {path.score.toFixed(2)}</p>{path.traversal && <p className="mt-2 text-xs text-muted-foreground">{path.traversal} · citations {path.citationIds?.map((id) => `[${id}]`).join(', ')}</p>}{path.pheromone !== undefined && <p className="mt-2 text-xs">Demo ACO pheromone: {path.pheromone.toFixed(2)}</p>}</> : <p className="mt-4 text-sm text-muted-foreground">No cited graph path for this result.</p>}
        {result.relations.map((edge) => <p key={edge.relationId} className="mt-3 rounded-lg border p-3 text-xs leading-5">{result.nodes.find((node) => node.entityId === edge.sourceEntity)?.canonicalName} — {edge.relationType} → {result.nodes.find((node) => node.entityId === edge.targetEntity)?.canonicalName}<br />Evidence: {edge.evidence}</p>)}
        {explanation.alternatives.map((item) => <p key={item.path} className="mt-3 text-xs">Alternative: {item.path} ({item.confidence.toFixed(2)})</p>)}
      </Card>
      <Card className="p-6 shadow-none"><h2 className="font-semibold">Recorded decision trace</h2><ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-muted-foreground">{explanation.decisionTrace.map((trace) => <li key={trace}>{trace}</li>)}</ol></Card>
    </section>
    <section><h2 className="text-lg font-semibold">Citations and source provenance</h2><div className="mt-4 grid gap-4 lg:grid-cols-2">{result.evidence.map((item) => <Card key={item.chunkId} className="p-5 shadow-none"><Badge variant="outline">[{item.citation ?? 'demo'}] {item.source}</Badge><p className="mt-3 text-sm leading-6">{item.excerpt ?? item.text}</p><p className="mt-3 break-all text-xs text-muted-foreground">{item.chunkId} · {item.documentId}</p><p className="mt-2 text-xs text-muted-foreground">Location: {JSON.stringify(item.sourceLocation ?? {})} · source reliability {item.reliability === null ? 'unrated' : item.reliability.toFixed(2)}</p><details className="mt-3 text-sm"><summary className="cursor-pointer text-primary">Full saved chunk</summary><p className="mt-2 leading-6">{item.text}</p></details></Card>)}</div></section>
  </>;
}

export default function ExplainabilityPage() {
  return <Suspense fallback={<p>Loading explanation…</p>}><ExplanationContent /></Suspense>;
}
