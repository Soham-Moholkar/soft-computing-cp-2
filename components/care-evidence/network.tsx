'use client';

import { useId, useRef, useState } from 'react';
import { CircleDot, Network } from 'lucide-react';
import type { Candidate, Mention } from './source';

const positions = [
  [50, 48],
  [24, 23],
  [76, 23],
  [16, 52],
  [84, 53],
  [26, 80],
  [72, 80],
  [50, 84],
];
const previewEdges = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [0, 5],
  [0, 6],
  [0, 7],
  [2, 4],
  [1, 3],
  [5, 7],
];

function link(from: number[], to: number[]) {
  const [x, y] = from;
  const [endX, endY] = to;
  const dx = endX - x;
  const dy = endY - y;
  return `M ${x} ${y} Q ${x + dx * 0.5 - dy * 0.12} ${y + dy * 0.5 + dx * 0.07} ${endX} ${endY}`;
}

export function HeroNetwork() {
  return (
    <div className="care-hero-art" aria-hidden="true">
      <div className="care-hero-orbit" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        {previewEdges.map(([from, to]) => (
          <path
            key={`${from}-${to}`}
            d={link(positions[from], positions[to])}
          />
        ))}
      </svg>
      {positions.map(([x, y], index) => (
        <span
          className={index === 0 ? 'care-orbit-core' : 'care-orbit-node'}
          style={{ left: `${x}%`, top: `${y}%` }}
          key={index}
        >
          {index === 0 ? <Network size={23} /> : null}
        </span>
      ))}
    </div>
  );
}

export function SourceNetwork({
  concepts,
  edges,
  selected,
  onSelect,
}: {
  concepts: Mention[];
  edges: Candidate[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const marker = useId();
  const [zoom, setZoom] = useState(1);
  const [page, setPage] = useState(0);
  const canvas = useRef<HTMLDivElement>(null);
  const degree = new Map<string, number>();
  const neighbors = new Set<string>([selected]);

  for (const edge of edges) {
    degree.set(edge.source_entity, (degree.get(edge.source_entity) ?? 0) + 1);
    degree.set(edge.target_entity, (degree.get(edge.target_entity) ?? 0) + 1);
    if (edge.source_entity === selected) neighbors.add(edge.target_entity);
    if (edge.target_entity === selected) neighbors.add(edge.source_entity);
  }

  const ordered = [...concepts].sort(
    (a, b) => (degree.get(b.entity_id) ?? 0) - (degree.get(a.entity_id) ?? 0),
  );
  const pageSize = 36;
  const pageCount = Math.max(1, Math.ceil(ordered.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const visible = ordered.slice(current * pageSize, (current + 1) * pageSize);
  const dense = visible.length > 9;
  const rows = Math.ceil(visible.length / 4);
  const hub = visible.length >= 5 && !dense;
  const points = visible.map((_, index) => {
    if (dense)
      return [
        14 + (index % 4) * 24,
        ((index / 4) | 0) * (100 / rows) + 50 / rows,
      ];
    const ringSize = visible.length - Number(hub);
    if (visible.length === 1 || (hub && index === 0)) return [50, 50];
    const angle =
      (2 * Math.PI * (index - Number(hub))) / ringSize - Math.PI / 2;
    return [50 + Math.cos(angle) * 35, 50 + Math.sin(angle) * 37];
  });
  const placed = new Map(
    visible.map((node, index) => [node.entity_id, points[index]]),
  );
  const visibleEdges = edges.filter(
    (edge) => placed.has(edge.source_entity) && placed.has(edge.target_entity),
  );

  function movePage(next: number) {
    setPage(next);
    onSelect('');
    canvas.current?.scrollTo(0, 0);
  }

  return (
    <div className="care-network-shell">
      <div className="care-network-toolbar">
        <span>
          <Network size={14} /> {visible.length} concepts ·{' '}
          {visibleEdges.length} links shown
        </span>
        <div className="care-network-controls">
          {pageCount > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous concepts"
                disabled={current === 0}
                onClick={() => movePage(current - 1)}
              >
                ‹
              </button>
              <span>
                {current + 1} / {pageCount}
              </span>
              <button
                type="button"
                aria-label="Next concepts"
                disabled={current + 1 === pageCount}
                onClick={() => movePage(current + 1)}
              >
                ›
              </button>
            </>
          )}
          <button
            type="button"
            aria-label="Zoom out"
            disabled={zoom === 1}
            onClick={() => setZoom(zoom - 0.25)}
          >
            −
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            disabled={zoom === 2}
            onClick={() => setZoom(zoom + 0.25)}
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              canvas.current?.scrollTo(0, 0);
            }}
          >
            Reset zoom
          </button>
        </div>
      </div>
      <div
        ref={canvas}
        className="care-network-scroll"
        aria-label="Scrollable graph canvas"
      >
        <div
          className={`care-network care-network-stage ${dense ? 'is-dense' : ''}`}
          style={{
            width: `${zoom * 100}%`,
            height: dense ? Math.max(350, rows * 105) * zoom : undefined,
          }}
        >
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <marker
                id={marker}
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M 0 0 L 8 4 L 0 8 Z" fill="#b3d9aa" />
              </marker>
            </defs>
            {visibleEdges.map((edge) => {
              const from = placed.get(edge.source_entity)!;
              const to = placed.get(edge.target_entity)!;
              const dx = to[0] - from[0];
              const dy = to[1] - from[1];
              const trim = Math.min(
                0.44,
                1 /
                  Math.max(
                    Math.abs(dx) / 12,
                    Math.abs(dy) / (dense ? 29 / rows : 7),
                  ),
              );
              const linked = [edge.source_entity, edge.target_entity].includes(
                selected,
              );
              return (
                <path
                  key={edge.candidate_id}
                  className={`care-network-edge ${linked ? 'is-connected' : selected ? 'is-dimmed' : ''}`}
                  d={link(from, [to[0] - dx * trim, to[1] - dy * trim])}
                  markerEnd={`url(#${marker})`}
                />
              );
            })}
          </svg>
          {visible.map((node, index) => (
            <button
              type="button"
              className={`care-node ${index === 0 && hub ? 'is-central' : ''} ${selected && !neighbors.has(node.entity_id) ? 'is-dimmed' : ''}`}
              aria-pressed={node.entity_id === selected}
              key={node.entity_id}
              style={{
                left: `${points[index][0]}%`,
                top: `${points[index][1]}%`,
              }}
              onClick={() => onSelect(node.entity_id)}
            >
              <CircleDot size={13} /> <span>{node.canonical_name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
