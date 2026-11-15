'use client';

import { useMemo, useState } from 'react';
import { Focus, Minus, Plus, RotateCcw } from 'lucide-react';
import type { GraphData } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const typeColors: Record<string, string> = {
  Concept: '#4f46e5',
  Technology: '#0891b2',
  Process: '#d97706',
  Domain: '#059669',
  Organization: '#7c3aed',
  Person: '#db2777',
  Location: '#0284c7',
  Event: '#dc2626',
  Document: '#64748b',
  Product: '#9333ea',
};

export function KnowledgeGraph({
  data,
  minimumConfidence = 0,
  entityType = 'All',
  relationType = 'All',
  highlightPath = [],
  onInspectEntity,
}: {
  data: GraphData;
  minimumConfidence?: number;
  entityType?: string;
  relationType?: string;
  highlightPath?: string[];
  onInspectEntity?: (entityId: string) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(data.entities[0]?.entityId ?? null);
  const [selectedRelationId, setSelectedRelationId] = useState<string | null>(null);

  const visibleEntities = useMemo(() => data.entities.filter((entity) =>
    entity.fuzzyConfidence >= minimumConfidence && (entityType === 'All' || entity.entityType === entityType)
  ), [data.entities, entityType, minimumConfidence]);
  const visibleIds = useMemo(() => new Set(visibleEntities.map((entity) => entity.entityId)), [visibleEntities]);
  const visibleRelations = useMemo(() => data.relations.filter((relation) =>
    relation.fuzzyStrength >= minimumConfidence &&
    visibleIds.has(relation.sourceEntity) &&
    visibleIds.has(relation.targetEntity) &&
    (relationType === 'All' || relation.relationType === relationType)
  ), [data.relations, minimumConfidence, relationType, visibleIds]);
  const byId = useMemo(() => new Map(data.entities.map((entity) => [entity.entityId, entity])), [data.entities]);
  const selectedEntity = selectedEntityId ? byId.get(selectedEntityId) : null;
  const selectedRelation = data.relations.find((relation) => relation.relationId === selectedRelationId);
  const pathPairs = useMemo(() => new Set(highlightPath.slice(0, -1).map((id, index) => id + ':' + highlightPath[index + 1])), [highlightPath]);

  function resetView() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  return (
    <div className="grid min-h-[620px] overflow-hidden rounded-xl border bg-slate-950 xl:grid-cols-[minmax(0,1fr)_310px]">
      <div className="relative min-h-[500px] overflow-hidden">
        <div className="absolute left-4 top-4 z-10 flex gap-2">
          <Button variant="secondary" size="icon" onClick={() => setZoom((value) => Math.min(2.2, value + 0.15))} aria-label="Zoom in"><Plus /></Button>
          <Button variant="secondary" size="icon" onClick={() => setZoom((value) => Math.max(0.5, value - 0.15))} aria-label="Zoom out"><Minus /></Button>
          <Button variant="secondary" size="icon" onClick={resetView} aria-label="Reset graph view"><RotateCcw /></Button>
          <Button variant="secondary" size="icon" onClick={() => setOffset({ x: 0, y: 0 })} aria-label="Center graph"><Focus /></Button>
        </div>
        <div className="absolute bottom-4 left-4 z-10 flex flex-wrap gap-2">
          {Object.entries(typeColors).slice(0, 4).map(([type, color]) => (
            <span key={type} className="flex items-center gap-1.5 rounded-full bg-slate-900/85 px-2.5 py-1 text-[10px] text-slate-300">
              <span className="size-2 rounded-full" style={{ backgroundColor: color }} /> {type}
            </span>
          ))}
        </div>
        <svg
          viewBox="0 0 900 640"
          className="h-full min-h-[620px] w-full touch-none select-none"
          onPointerDown={(event) => setDragStart({ x: event.clientX - offset.x, y: event.clientY - offset.y })}
          onPointerMove={(event) => dragStart && setOffset({ x: event.clientX - dragStart.x, y: event.clientY - dragStart.y })}
          onPointerUp={() => setDragStart(null)}
          onPointerLeave={() => setDragStart(null)}
          onWheel={(event) => setZoom((value) => Math.max(0.5, Math.min(2.2, value + (event.deltaY < 0 ? 0.08 : -0.08))))}
          aria-label="Interactive knowledge graph"
        >
          <defs>
            <pattern id="graph-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#1e293b" strokeWidth="1" />
            </pattern>
            <filter id="node-glow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <rect width="900" height="640" fill="url(#graph-grid)" />
          <g transform={'translate(' + offset.x + ' ' + offset.y + ') scale(' + zoom + ')'} style={{ transformOrigin: '450px 320px' }}>
            {visibleRelations.map((relation) => {
              const source = byId.get(relation.sourceEntity);
              const target = byId.get(relation.targetEntity);
              if (!source || !target) return null;
              const inPath = pathPairs.has(source.entityId + ':' + target.entityId) || pathPairs.has(target.entityId + ':' + source.entityId);
              return (
                <line
                  key={relation.relationId}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={inPath ? '#fbbf24' : '#64748b'}
                  strokeWidth={inPath ? 3 : 0.7 + relation.fuzzyStrength * 1.8}
                  strokeOpacity={inPath ? 1 : 0.22 + relation.fuzzyStrength * 0.45}
                  onClick={(event) => { event.stopPropagation(); setSelectedRelationId(relation.relationId); setSelectedEntityId(null); onInspectEntity?.(relation.sourceEntity); }}
                  className="cursor-pointer"
                />
              );
            })}
            {visibleEntities.map((entity) => {
              const selected = selectedEntity?.entityId === entity.entityId;
              const inPath = highlightPath.includes(entity.entityId);
              const radius = 6 + entity.importanceScore * 7;
              return (
                // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- SVG groups cannot be HTML buttons; keyboard handlers provide button semantics.
                <g role="button"
                  key={entity.entityId}
                  transform={'translate(' + entity.x + ' ' + entity.y + ')'}
                  className="cursor-pointer"
                  tabIndex={0}
                  aria-label={`Inspect ${entity.canonicalName}`}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedEntityId(entity.entityId); setSelectedRelationId(null); onInspectEntity?.(entity.entityId); } }}
                  onClick={(event) => { event.stopPropagation(); setSelectedEntityId(entity.entityId); setSelectedRelationId(null); onInspectEntity?.(entity.entityId); }}
                >
                  {(selected || inPath) && <circle r={radius + 6} fill="none" stroke={inPath ? '#fbbf24' : '#a5b4fc'} strokeWidth="2" opacity="0.8" />}
                  <circle r={radius} fill={typeColors[entity.entityType] ?? '#64748b'} stroke="#e2e8f0" strokeWidth={selected ? 2 : 0.8} filter={selected ? 'url(#node-glow)' : undefined} />
                  {(selected || inPath || entity.importanceScore > 0.82) && (
                    <text y={radius + 15} textAnchor="middle" fill="#e2e8f0" fontSize="9" fontWeight="600">
                      {entity.canonicalName.length > 25 ? entity.canonicalName.slice(0, 23) + '…' : entity.canonicalName}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <aside className="border-l border-slate-800 bg-slate-900 p-5 text-slate-100">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Inspector</p>
          <Badge className="bg-slate-800 text-slate-300">{visibleEntities.length} nodes</Badge>
        </div>
        {selectedEntity && (
          <div className="mt-6 space-y-5">
            <div>
              <Badge style={{ backgroundColor: typeColors[selectedEntity.entityType] }}>{selectedEntity.entityType}</Badge>
              <h3 className="mt-3 text-xl font-semibold">{selectedEntity.canonicalName}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{selectedEntity.description}</p>
            </div>
            <dl className="grid grid-cols-2 gap-3">
              {[
                ['Fuzzy confidence', selectedEntity.fuzzyConfidence],
                ['Extraction', selectedEntity.extractionConfidence],
                ['Centrality', selectedEntity.centralityScore],
                ['Importance', selectedEntity.importanceScore],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <dt className="text-[10px] text-slate-500">{label}</dt>
                  <dd className="mt-1 font-mono text-sm">{Number(value).toFixed(2)}</dd>
                </div>
              ))}
            </dl>
            <div>
              <p className="text-xs font-semibold text-slate-300">Aliases</p>
              <div className="mt-2 flex flex-wrap gap-2">{selectedEntity.aliases.map((alias) => <Badge key={alias} className="bg-slate-800 text-slate-300">{alias}</Badge>)}</div>
            </div>
          </div>
        )}
        {selectedRelation && (
          <div className="mt-6 space-y-5">
            <div>
              <Badge className="bg-indigo-500">{selectedRelation.relationType.replaceAll('_', ' ')}</Badge>
              <h3 className="mt-3 text-lg font-semibold">
                {byId.get(selectedRelation.sourceEntity)?.canonicalName} → {byId.get(selectedRelation.targetEntity)?.canonicalName}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{selectedRelation.evidence}</p>
            </div>
            <dl className="space-y-3">
              {[
                ['Fuzzy strength', selectedRelation.fuzzyStrength],
                ['Extraction confidence', selectedRelation.extractionConfidence],
                ['Semantic strength', selectedRelation.semanticStrength],
                ['Final weight', selectedRelation.finalWeight],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <div className="mb-1 flex justify-between text-xs"><dt className="text-slate-400">{label}</dt><dd className="font-mono">{Number(value).toFixed(2)}</dd></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-indigo-400" style={{ width: Number(value) * 100 + '%' }} /></div>
                </div>
              ))}
            </dl>
          </div>
        )}
      </aside>
    </div>
  );
}
