'use client';

import { useEffect, useRef, useState } from 'react';
import Link from '@/components/common/app-link';
import {
  Check,
  Clock3,
  Network,
  Search,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import type { RetrievalMode, RetrievalResult } from '@/lib/types';
import { services, serviceMode } from '@/services';
import { ScoreBars } from '@/components/charts/score-bars';
import { EducationPanel } from '@/components/common/education-panel';
import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';

const modes: Array<{ value: RetrievalMode; label: string }> = [
  { value: serviceMode === 'api' ? 'lexical' : 'semantic', label: serviceMode === 'api' ? 'Lexical baseline' : 'Semantic' },
  { value: 'graph', label: 'Graph' },
  { value: 'fuzzy', label: 'Fuzzy' },
  ...(serviceMode === 'api' ? [] : [{ value: 'aco' as const, label: 'ACO' }]),
  { value: 'hybrid', label: 'Hybrid' },
];

const defaultQuery =
  'How is Particle Swarm Optimization related to Knowledge Graph?';

export default function RetrievalPage() {
  const [query, setQuery] = useState(defaultQuery);
  const [mode, setMode] = useState<RetrievalMode>('hybrid');
  const [topK, setTopK] = useState(5);
  const [maxHops, setMaxHops] = useState(4);
  const [result, setResult] = useState<RetrievalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [useProvider, setUseProvider] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);

  async function retrieve() {
    if (!query.trim()) {
      setError('Enter a natural-language question.');
      return;
    }
    setLoading(true);
    setError('');
    setFeedback('');
    setResult(null);
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    try {
      const response =
        mode === 'hybrid'
          ? await services.hybrid.retrieve({ query, mode, topK, maxHops, useProvider, signal: controller.signal })
          : await services.retrieval.retrieve({ query, mode, topK, maxHops, useProvider, signal: controller.signal });
      if (controller.signal.aborted) return;
      setResult(response);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'The retrieval service could not complete this query.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    if (serviceMode === 'api') return () => activeRequest.current?.abort();
    void services.hybrid
      .retrieve({ query: defaultQuery, mode: 'hybrid', topK: 5, maxHops: 4 })
      .then(setResult)
      .catch(() =>
        setError('The retrieval service could not complete this query.'),
      );
    return () => activeRequest.current?.abort();
  }, []);

  async function submitFeedback(value: 'relevant' | 'partial' | 'irrelevant') {
    setFeedbackLoading(true);
    try {
      const response = await services.hybrid.submitFeedback(value, result?.resultId);
      setFeedback(response.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Feedback could not be saved.');
    } finally {
      setFeedbackLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Natural-language graph intelligence"
        title="Retrieval playground"
        description="Ask a question, select a retrieval strategy and inspect the evidence, graph paths, fuzzy rules and weighted score that produced the answer."
        icon={Search}
      />

      <Card className="border-slate-200 p-5 shadow-none">
        {serviceMode === 'api' && <p className="mb-4 text-sm text-muted-foreground">Searches your saved sources. Hybrid combines BM25, graph proximity and fixed fuzzy rules. Embeddings and trained optimizers are pending.</p>}
        <label htmlFor="retrieval-query" className="text-sm font-semibold">
          Ask SoftGraph
          <Textarea
            id="retrieval-query"
            disabled={loading}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="mt-2 min-h-24 resize-none text-base"
          />
        </label>
        <div className="mt-4 flex flex-col gap-4 border-t pt-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {modes.map((item) => (
              <Button
                key={item.value}
                variant={mode === item.value ? 'default' : 'outline'}
                onClick={() => setMode(item.value)} disabled={loading}
              >
                {item.value === 'hybrid' && <Sparkles />} {item.label} retrieval
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Top K
              <NativeSelect
                value={String(topK)}
                disabled={loading}
                onChange={(event) => setTopK(Number(event.target.value))}
              >
                {[3, 5, 10].map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {value}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Max hops
              <NativeSelect
                value={String(maxHops)}
                disabled={loading}
                onChange={(event) => setMaxHops(Number(event.target.value))}
              >
                {[2, 3, 4, 5].map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {value}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <Button onClick={retrieve} disabled={loading} className="h-9 px-4">
              {loading ? 'Reasoning…' : 'Retrieve answer'} <Search />
            </Button>
          </div>
        </div>
        {serviceMode === 'api' && <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={useProvider} disabled={loading} onChange={(event) => setUseProvider(event.target.checked)} className="mt-1" /><span>Use OpenRouter to rerank evidence<br /><span className="text-xs text-muted-foreground">Sends this question and candidate excerpts to the configured free model. Daily budget applies; failures use local ranking.</span></span></label>}
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </p>
        )}
      </Card>

      {result && (
        <>
          <section className="grid gap-5 xl:grid-cols-[1fr_390px]">
            <Card className="border-slate-200 p-6 shadow-none">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge className={result.answerStatus === 'insufficient_evidence' ? 'bg-amber-700' : 'bg-emerald-600'}>
                    <Check /> {result.answerStatus === 'insufficient_evidence' ? 'Insufficient evidence' : result.answerStatus === 'evidence' ? 'Cited source excerpts' : 'Demo answer'}
                  </Badge>
                  <Badge variant="outline">{result.mode.toUpperCase()}</Badge>
                </div>
                <div className="text-right">
                  <p className="font-mono text-2xl font-semibold text-emerald-700">
                    {(result.confidence * 100).toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {serviceMode === 'api' ? 'heuristic ranking score' : 'final confidence'}
                  </p>
                </div>
              </div>
              {result.query && <p className="mt-4 text-sm font-medium">Question: {result.query}</p>}
              <p className="mt-5 whitespace-pre-wrap text-base leading-8 text-slate-700">
                {result.answer}
              </p>
              {result.resultId && <div className="mt-4 space-y-2 text-xs text-muted-foreground"><p>Result: {result.resultId}</p><p>{result.graphVersion} · {result.indexVersion} · {result.configurationVersion}</p><p>OpenRouter: {result.providerStatus}</p><p>{result.confidenceLabel}</p><Link href={`/explainability?result=${encodeURIComponent(result.resultId)}`} className="inline-block text-primary underline">Explain this saved result</Link></div>}
              {result.warnings?.map((warning) => <p key={warning} className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-950">{warning}</p>)}
              {!!result.evidence.length && <div className="mt-4 flex flex-wrap gap-2">{result.evidence.map((item) => <a key={item.chunkId} href={`#evidence-${item.citation}`} className="text-xs text-primary underline">[{item.citation ?? item.chunkId}] {item.source}</a>)}</div>}
              <div className="mt-6 border-t pt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Retrieved concepts
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.nodes.map((node) => (
                    <Badge key={node.entityId} variant="secondary">
                      {node.canonicalName}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="mt-6 border-t pt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Reasoning paths
                </p>
                <div className="mt-3 space-y-3">
                  {result.paths.map((path) => (
                    <div
                      key={path.labels.join('-')}
                      className="rounded-lg border bg-slate-50 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">
                          {path.labels.join(' → ')}
                        </p>
                        <div className="flex gap-2">
                          <Badge variant="outline">
                            score {path.score.toFixed(2)}
                          </Badge>
                          {path.pheromone !== undefined && <Badge variant="outline">pheromone {path.pheromone.toFixed(2)}</Badge>}
                        </div>
                      </div>
                      {path.traversal && <p className="mt-2 text-xs text-muted-foreground">{path.traversal}. Citations: {path.citationIds?.map((id) => `[${id}]`).join(', ')}</p>}
                    </div>
                  ))}
                  {!result.paths.length && <p className="text-sm text-muted-foreground">No supported path in this result.</p>}
                </div>
              </div>
              <div className="mt-6 border-t pt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Was this evidence useful?
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={feedbackLoading}
                    onClick={() => submitFeedback('relevant')}
                  >
                    <ThumbsUp /> Relevant
                  </Button>
                  <Button
                    variant="outline"
                    disabled={feedbackLoading}
                    onClick={() => submitFeedback('partial')}
                  >
                    Partially relevant
                  </Button>
                  <Button
                    variant="outline"
                    disabled={feedbackLoading}
                    onClick={() => submitFeedback('irrelevant')}
                  >
                    <ThumbsDown /> Irrelevant
                  </Button>
                </div>
                {feedback && (
                  <p className="mt-3 text-xs text-emerald-700">{feedback}</p>
                )}
              </div>
            </Card>

            <div className="space-y-5">
              <Card className="border-slate-200 p-5 shadow-none">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Score composition</h2>
                  <Badge variant="outline">Σ weights = 1.00</Badge>
                </div>
                <ScoreBars
                  data={result.scoreBreakdown.map((item) => ({
                    name: item.component,
                    value: item.contribution,
                  }))}
                  domain={[0, 1]}
                />
              </Card>
              <Card className="border-slate-200 p-5 shadow-none">
                <div className="flex items-center gap-2">
                  <Network className="size-4 text-primary" />
                  <h2 className="font-semibold">Fuzzy inference</h2>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {result.fuzzyExplanation.ruleFirings.filter((rule) => rule.strength > 0).map((rule) => `${rule.rule} (firing ${rule.strength.toFixed(2)})`).join(' · ')}
                </p>
                <div className="mt-4 flex items-end justify-between rounded-lg bg-primary/5 p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Defuzzified score
                    </p>
                    <p className="mt-1 font-mono text-2xl font-semibold text-primary">
                      {result.fuzzyExplanation.score.toFixed(2)}
                    </p>
                  </div>
                  <Badge>{result.fuzzyExplanation.label}</Badge>
                </div>
              </Card>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <Card className="border-slate-200 p-5 shadow-none">
              <h2 className="font-semibold">Evidence chunks</h2>
              <div className="mt-4 space-y-3">
                {result.evidence.map((evidence) => (
                  <div key={evidence.chunkId} id={`evidence-${evidence.citation}`} className="scroll-mt-24 rounded-lg border p-4">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono text-primary">
                        [{evidence.citation ?? 'demo'}] {evidence.chunkId.slice(0, 22)}…
                      </span>
                      <span>
                        {evidence.reliability === null ? 'source reliability unrated' : `source reliability ${evidence.reliability.toFixed(2)}`}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6">{evidence.text}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {evidence.source}
                    </p>
                    {evidence.sourceLocation && <p className="mt-2 break-all text-xs text-muted-foreground">Location: {JSON.stringify(evidence.sourceLocation)} · {evidence.documentId}</p>}
                    {evidence.excerpt && <details className="mt-3 text-sm"><summary className="cursor-pointer text-primary">Cited excerpt</summary><p className="mt-2 leading-6">{evidence.excerpt}</p></details>}
                  </div>
                ))}
              </div>
            </Card>
            <Card className="border-slate-200 p-5 shadow-none">
              <h2 className="font-semibold">Processing timeline</h2>
              <div className="mt-4 space-y-3">
                {result.timeline.map((item) => (
                  <div key={item.stage} className="flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                      <Clock3 className="size-4" />
                    </span>
                    <div className="flex flex-1 items-center justify-between border-b pb-3">
                      <span className="text-sm">{item.stage}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {item.durationMs} ms
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        </>
      )}

      <EducationPanel
        title="Hybrid retrieval"
        items={{
          'What is this?':
            'A lexical baseline combined with graph proximity and fixed fuzzy rules. Trained embeddings and optimized weights come later.',
          'Why is it being used?':
            'No single signal is reliable enough for ambiguous multi-hop questions.',
          'How does it work?':
            'Find seeds, explore paths, infer relevance, rank evidence and explain the score.',
          'Where is it used in SoftGraph?':
            'The final answer and evidence pipeline.',
          Inputs: 'Query text, top K, maximum hops and retrieval mode.',
          Outputs: 'Answer, evidence, subgraph, paths, scores and explanation.',
          Parameters:
            'BM25 k1=1.2, b=0.75; hybrid weights 0.60 lexical, 0.25 graph, 0.15 fuzzy; evidence and hop limits.',
          Example: 'PSO tunes ranking while ACO finds a useful reasoning path.',
        }}
      />
    </>
  );
}
