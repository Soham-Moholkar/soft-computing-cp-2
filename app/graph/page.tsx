'use client';
import Link from '@/components/common/app-link';
import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, Network, Route, Search } from 'lucide-react';
import type { GraphData } from '@/lib/types';
import { serviceMode, services } from '@/services';
import type {
  GraphBuildSummary,
  GraphDocumentStatus,
  GraphEntityEvidence,
  GraphExtraction,
} from '@/services/contracts';
import { KnowledgeGraph } from '@/components/graph/knowledge-graph';
import { PageHeader } from '@/components/common/page-header';
import { EducationPanel } from '@/components/common/education-panel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Slider } from '@/components/ui/slider';
export default function GraphPage() {
  const [data, setData] = useState<GraphData | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [entityType, setEntityType] = useState('All');
  const [relationType, setRelationType] = useState('All');
  const [minimumConfidence, setMinimumConfidence] = useState(0.55);
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [highlightPath, setHighlightPath] = useState<string[]>([]);
  const [pathMessage, setPathMessage] = useState('');
  const [documents, setDocuments] = useState<GraphDocumentStatus[]>([]);
  const [documentId, setDocumentId] = useState('');
  const [entityThreshold, setEntityThreshold] = useState(0.8);
  const [relationThreshold, setRelationThreshold] = useState(0.75);
  const [busy, setBusy] = useState(false);
  const [buildResult, setBuildResult] = useState<GraphBuildSummary | null>(
    null,
  );
  const [extraction, setExtraction] = useState<GraphExtraction | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [evidence, setEvidence] = useState<GraphEntityEvidence | null>(null);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    Promise.all([
      services.graph.getGraph(controller.signal),
      services.graph.documents?.() ?? Promise.resolve([]),
    ])
      .then(([graph, recent]) => {
        if (!active) return;
        setData(graph);
        setDocuments(recent);
        setDocumentId(
          recent.find(
            (item) =>
              item.documentId ===
              new URLSearchParams(window.location.search).get('document'),
          )?.documentId ??
            recent[0]?.documentId ??
            '',
        );
        setSource(graph.entities[0]?.entityId ?? '');
        setTarget(
          graph.entities[1]?.entityId ?? graph.entities[0]?.entityId ?? '',
        );
      })
      .catch((caught: unknown) => {
        if (active)
          setError(
            caught instanceof Error
              ? caught.message
              : 'The graph service is unavailable.',
          );
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);
  useEffect(() => {
    let active = true;
    if (selectedEntityId && services.graph.entityDetail) {
      services.graph
        .entityDetail(selectedEntityId)
        .then((detail) => {
          if (active) setEvidence(detail);
        })
        .catch((caught: unknown) => {
          if (active)
            setError(
              caught instanceof Error
                ? caught.message
                : 'Evidence could not be loaded.',
            );
        });
    }
    return () => {
      active = false;
    };
  }, [selectedEntityId]);
  async function refresh() {
    const [graph, recent] = await Promise.all([
      services.graph.getGraph(),
      services.graph.documents?.() ?? Promise.resolve([]),
    ]);
    setData(graph);
    setDocuments(recent);
    setHighlightPath([]);
    setSelectedEntityId('');
    setEvidence(null);
    setPathMessage('');
    setSource((previous) =>
      graph.entities.some((item) => item.entityId === previous)
        ? previous
        : (graph.entities[0]?.entityId ?? ''),
    );
    setTarget((previous) =>
      graph.entities.some((item) => item.entityId === previous)
        ? previous
        : (graph.entities[1]?.entityId ?? graph.entities[0]?.entityId ?? ''),
    );
    setDocumentId((previous) =>
      recent.some((item) => item.documentId === previous)
        ? previous
        : (recent[0]?.documentId ?? ''),
    );
  }
  async function build(dryRun: boolean) {
    if (!services.graph.build || !documentId) return;
    setBusy(true);
    setError('');
    setExtraction(null);
    try {
      const result = await services.graph.build([documentId], {
        dryRun,
        entityThreshold,
        relationThreshold,
      });
      setBuildResult(result);
      if (!dryRun) {
        await refresh();
        if (services.graph.extraction)
          setExtraction(await services.graph.extraction(documentId));
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Graph build failed.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function inspectExtraction() {
    if (!documentId || !services.graph.extraction) return;
    setBusy(true);
    setError('');
    try {
      setExtraction(await services.graph.extraction(documentId));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Extraction could not be loaded.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function removeContributions() {
    if (!documentId || !services.graph.removeDocument) return;
    setBusy(true);
    setError('');
    try {
      await services.graph.removeDocument(documentId);
      setExtraction(null);
      setBuildResult(null);
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Graph removal failed.',
      );
    } finally {
      setBusy(false);
    }
  }
  const filteredData = useMemo(() => {
    if (!data || !query.trim()) return data;
    const matchingIds = new Set(
      data.entities
        .filter((entity) =>
          (entity.canonicalName + ' ' + entity.aliases.join(' '))
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .map((entity) => entity.entityId),
    );
    const neighborIds = new Set<string>(matchingIds);
    data.relations.forEach((relation) => {
      if (matchingIds.has(relation.sourceEntity))
        neighborIds.add(relation.targetEntity);
      if (matchingIds.has(relation.targetEntity))
        neighborIds.add(relation.sourceEntity);
    });
    return {
      entities: data.entities.filter((entity) =>
        neighborIds.has(entity.entityId),
      ),
      relations: data.relations.filter(
        (relation) =>
          neighborIds.has(relation.sourceEntity) &&
          neighborIds.has(relation.targetEntity),
      ),
    };
  }, [data, query]);
  async function findPath() {
    setBusy(true);
    setError('');
    try {
      const path = await services.graph.shortestPath(
        source,
        target,
        serviceMode === 'api'
          ? {
              minimumConfidence,
              relationTypes: relationType === 'All' ? [] : [relationType],
            }
          : undefined,
      );
      setHighlightPath(path);
      setPathMessage(
        path.length
          ? 'Path uses the saved graph; search and entity-type filters may hide intermediate nodes.'
          : 'No path exists within six hops under the active relation and confidence filters.',
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Path search failed.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Interactive knowledge model"
        title="Knowledge graph explorer"
        description={
          serviceMode === 'api'
            ? `Inspect concepts and evidence-backed relations built from your saved documents. ${data?.entities.length ?? 0} entities · ${data?.relations.length ?? 0} relations · ${data?.graphVersion ?? 'loading'}.`
            : 'Pan, zoom and inspect the demonstration graph. Edge opacity and width encode fuzzy relation strength.'
        }
        icon={Network}
      />
      {serviceMode === 'api' && (
        <Card className="space-y-4 border-slate-200 p-5 shadow-none">
          <h2 className="text-lg font-semibold">Build from saved documents</h2>
          <div className="flex gap-4 text-sm">
            <Link href="/ingestion" className="underline">
              1. Ingest a source
            </Link>
            <span>2. Build and inspect evidence</span>
            <Link href="/retrieval" className="underline">
              3. Ask a question
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            Course concept and alias matching is a deterministic baseline.
            Confidence values are untrained heuristics. Uncertain predicates and
            co-occurrence stay in the review list.
          </p>
          <label className="block space-y-2 text-sm">
            Document
            <NativeSelect
              aria-label="Build document"
              value={documentId}
              disabled={busy}
              className="w-full"
              onChange={(event) => {
                setDocumentId(event.target.value);
                setExtraction(null);
                setBuildResult(null);
              }}
            >
              {!documents.length && (
                <NativeSelectOption value="">
                  Ingest a document first
                </NativeSelectOption>
              )}
              {documents.map((item) => (
                <NativeSelectOption
                  key={item.documentId}
                  value={item.documentId}
                >
                  {item.name} ·{' '}
                  {item.built
                    ? `${item.acceptedMentions} mentions, ${item.acceptedRelations} assertions, ${item.reviewCount} for review`
                    : 'Not built'}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label htmlFor="entity-threshold" className="space-y-2 text-sm">
              Entity acceptance threshold
              <Input
                id="entity-threshold"
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={entityThreshold}
                disabled={busy}
                onChange={(event) =>
                  setEntityThreshold(Number(event.target.value))
                }
              />
            </label>
            <label htmlFor="relation-threshold" className="space-y-2 text-sm">
              Relation acceptance threshold
              <Input
                id="relation-threshold"
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={relationThreshold}
                disabled={busy}
                onChange={(event) =>
                  setRelationThreshold(Number(event.target.value))
                }
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || !documentId} onClick={() => build(true)}>
              Preview build
            </Button>
            <Button disabled={busy || !documentId} onClick={() => build(false)}>
              Build graph
            </Button>
            <Button
              variant="outline"
              disabled={busy || !documentId}
              onClick={inspectExtraction}
            >
              Inspect extraction
            </Button>
            <Button
              variant="outline"
              disabled={
                busy ||
                !documents.find((item) => item.documentId === documentId)?.built
              }
              onClick={removeContributions}
            >
              Remove graph contributions
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await refresh();
                } catch (caught) {
                  setError(
                    caught instanceof Error
                      ? caught.message
                      : 'Refresh failed.',
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Refresh graph
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Removal retains the document and chunks so you can build them again.
            Rebuilding replaces this document’s contributions and preserves
            other source evidence.
          </p>
          {buildResult && (
            <div
              aria-live="polite"
              className="space-y-2 rounded-lg border p-3 text-sm"
            >
              <p>
                {buildResult.dryRun ? 'Preview only' : 'Build saved'} ·{' '}
                {buildResult.graphVersion} · Nodes: {buildResult.addedNodes}{' '}
                added, {buildResult.updatedNodes} updated,{' '}
                {buildResult.removedNodes} removed · Relations:{' '}
                {buildResult.addedRelations} added,{' '}
                {buildResult.updatedRelations} updated,{' '}
                {buildResult.removedRelations} removed ·{' '}
                {buildResult.reviewCount} candidates for review ·{' '}
                {buildResult.changed ? 'Changes found' : 'Already current'}
              </p>
              {buildResult.warnings.map((warning) => (
                <p key={warning} className="text-xs text-muted-foreground">
                  {warning}
                </p>
              ))}
            </div>
          )}
        </Card>
      )}
      <Card className="border-slate-200 p-4 shadow-none">
        <div className="grid gap-4 lg:grid-cols-[minmax(180px,1.3fr)_1fr_1fr_1.3fr]">
          <label
            htmlFor="graph-search"
            className="space-y-2 text-xs font-medium"
          >
            Search entity
            <div className="relative">
              <Search className="absolute left-2.5 top-2 size-4 text-muted-foreground" />
              <Input
                id="graph-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-8"
                placeholder="PSO, fuzzy, graph…"
              />
            </div>
          </label>
          <label className="space-y-2 text-xs font-medium">
            Entity type
            <NativeSelect
              className="w-full"
              value={entityType}
              onChange={(event) => setEntityType(event.target.value)}
            >
              {['All', 'Concept', 'Technology', 'Process', 'Domain'].map(
                (type) => (
                  <NativeSelectOption key={type} value={type}>
                    {type}
                  </NativeSelectOption>
                ),
              )}
            </NativeSelect>
          </label>
          <label className="space-y-2 text-xs font-medium">
            Relation
            <NativeSelect
              className="w-full"
              value={relationType}
              onChange={(event) => setRelationType(event.target.value)}
            >
              <NativeSelectOption value="All">All relations</NativeSelectOption>
              {(data
                ? Array.from(
                    new Set(
                      data.relations.map((relation) => relation.relationType),
                    ),
                  ).slice(0, 12)
                : []
              ).map((type) => (
                <NativeSelectOption key={type} value={type}>
                  {type.replaceAll('_', ' ')}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <div className="space-y-3">
            <div className="flex justify-between text-xs font-medium">
              <span>Minimum fuzzy confidence</span>
              <span className="font-mono">{minimumConfidence.toFixed(2)}</span>
            </div>
            <Slider
              value={[minimumConfidence]}
              min={0.5}
              max={0.95}
              step={0.01}
              onValueChange={(value) =>
                setMinimumConfidence(Array.isArray(value) ? value[0] : value)
              }
            />
          </div>
        </div>
        <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-[1fr_1fr_auto]">
          <NativeSelect
            aria-label="Path source"
            className="w-full"
            value={source}
            onChange={(event) => setSource(event.target.value)}
          >
            {(data?.entities ?? []).map((entity) => (
              <NativeSelectOption key={entity.entityId} value={entity.entityId}>
                {entity.canonicalName}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Path target"
            className="w-full"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          >
            {(data?.entities ?? []).map((entity) => (
              <NativeSelectOption key={entity.entityId} value={entity.entityId}>
                {entity.canonicalName}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button onClick={findPath} disabled={busy || !source || !target}>
            <Route /> Find shortest path
          </Button>
        </div>
        {highlightPath.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Highlighted path:{' '}
            {highlightPath
              .map(
                (id) =>
                  data?.entities.find((entity) => entity.entityId === id)
                    ?.canonicalName ?? id,
              )
              .join(' → ')}
          </p>
        )}
        {pathMessage && (
          <p className="mt-3 text-sm" aria-live="polite">
            {pathMessage}
          </p>
        )}
      </Card>
      {error && (
        <Card className="border-red-200 bg-red-50 p-6 text-red-800">
          {error}
        </Card>
      )}
      {filteredData ? (
        filteredData.entities.length ? (
          <KnowledgeGraph
            key={data?.graphVersion ?? 'mock'}
            data={filteredData}
            minimumConfidence={minimumConfidence}
            entityType={entityType}
            relationType={relationType}
            highlightPath={highlightPath}
            onInspectEntity={(entityId) => {
              if (entityId !== selectedEntityId) {
                setEvidence(null);
                setSelectedEntityId(entityId);
              }
            }}
          />
        ) : (
          <Card className="p-6">
            {data?.entities.length
              ? 'No entities match your search.'
              : 'The graph is empty. Ingest a course document and build its graph above.'}
          </Card>
        )
      ) : (
        <Card className="grid min-h-[500px] place-items-center">
          <LoaderCircle className="size-8 animate-spin text-primary" />
        </Card>
      )}
      {evidence && (
        <Card className="space-y-3 p-5">
          <h2 className="text-lg font-semibold">
            Source evidence: {evidence.canonicalName}
          </h2>
          <p className="text-xs text-muted-foreground">
            {evidence.graphVersion} · entity mentions and incident relations
          </p>
          {evidence.evidence.map((item) => (
            <div key={item.chunkId} className="space-y-2 rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">
                {item.documentName} ·{' '}
                {Object.entries(item.location)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(' · ')}
              </p>
              <p className="break-words whitespace-pre-wrap text-sm">
                {item.text}
              </p>
              <p className="break-all font-mono text-xs text-muted-foreground">
                {item.chunkId}
              </p>
            </div>
          ))}
        </Card>
      )}
      {extraction && (
        <Card className="space-y-3 p-5">
          <h2 className="text-lg font-semibold">Extraction and review</h2>
          <p className="text-sm">
            {extraction.mentions.length} mentions ·{' '}
            {extraction.candidates.length} relation candidates. Showing the
            first 50 of each.
          </p>
          {extraction.mentions.slice(0, 50).map((item, index) => (
            <p className="text-sm" key={item.chunkId + item.start + index}>
              {item.surface} → {item.canonicalName} ·{' '}
              {item.confidence.toFixed(2)} ·{' '}
              {item.accepted ? 'Accepted' : 'Review'} · span {item.start}–
              {item.end}
            </p>
          ))}
          {extraction.candidates.slice(0, 50).map((item, index) => (
            <div
              className="rounded-lg border p-3 text-sm"
              key={item.chunkId + index}
            >
              <p>
                {item.relationType} · {item.confidence.toFixed(2)} ·{' '}
                {item.accepted ? 'Accepted' : 'Review'} · {item.reason}
              </p>
              <p className="mt-2">{item.evidence}</p>
            </div>
          ))}
        </Card>
      )}
      <EducationPanel
        title="Fuzzy weighted knowledge graphs"
        items={{
          'What is this?':
            'A graph where nodes are entities and edges are typed, evidenced relations.',
          'Why is it being used?':
            'Graph structure supports neighborhood exploration and multi-hop reasoning.',
          'How does it work?':
            'Node and edge filters operate over typed service data; confidence controls visual strength.',
          'Where is it used in SoftGraph?':
            'Entity linking, graph retrieval, ACO traversal and explainability.',
          Inputs: 'Entities, relations, evidence chunks and fuzzy confidence.',
          Outputs: 'Filtered subgraphs, paths and inspection records.',
          Parameters:
            'Entity type, relation type, source, confidence and maximum hops.',
          Example: 'PSO → Retrieval Relevance → Knowledge Graph.',
        }}
      />
    </>
  );
}
