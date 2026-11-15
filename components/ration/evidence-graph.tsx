'use client';

import { useState } from 'react';
import { ArrowRight, GitBranch, Quote } from 'lucide-react';

export interface ProofEdge {
  id: string;
  from: string;
  verb: string;
  to: string;
  quote: string;
  citation: string;
  url?: string;
}

export function EvidenceGraph({
  edges,
  words,
  title,
}: {
  edges: ProofEdge[];
  words: [string, string];
  title: string;
}) {
  const [edgeId, setEdgeId] = useState('');
  const selected = edges.find((edge) => edge.id === edgeId) ?? edges[0];
  const labels = [...new Set(edges.flatMap((edge) => [edge.from, edge.to]))];
  const points = new Map(
    labels.map((label, index) => [
      label,
      {
        x: 19 + (index % 3) * 31,
        y: ((Math.floor(index / 3) + 0.5) * 100) / Math.ceil(labels.length / 3),
      },
    ]),
  );

  return (
    <section className="rs-proof" aria-label={title}>
      <div className="rs-proof-title">
        <GitBranch size={19} />
        <h3>{title}</h3>
      </div>
      {selected ? (
        <>
          <div
            className="rs-proof-canvas"
            style={{
              minHeight: Math.max(125, Math.ceil(labels.length / 3) * 79),
            }}
          >
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {edges.map((edge) => {
                const from = points.get(edge.from)!;
                const to = points.get(edge.to)!;
                return (
                  <path
                    key={edge.id}
                    className={
                      edge.id === selected.id
                        ? 'rs-edge-active'
                        : 'rs-edge-other'
                    }
                    d={`M ${from.x} ${from.y} Q ${(from.x + to.x) / 2 - 3} ${(from.y + to.y) / 2 + 3} ${to.x} ${to.y}`}
                  />
                );
              })}
            </svg>
            {labels.map((label) => {
              const point = points.get(label)!;
              const active = [selected.from, selected.to].includes(label);
              return (
                <button
                  key={label}
                  type="button"
                  className={active ? 'rs-graph-node active' : 'rs-graph-node'}
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  aria-pressed={active}
                  onClick={() =>
                    setEdgeId(
                      edges.find(
                        (edge) =>
                          edge.id !== selected.id &&
                          [edge.from, edge.to].includes(label),
                      )?.id ??
                        edges.find((edge) =>
                          [edge.from, edge.to].includes(label),
                        )!.id,
                    )
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
          <ol className="rs-edge-list">
            {edges.map((edge, index) => (
              <li key={edge.id}>
                <button
                  type="button"
                  aria-pressed={edge.id === selected.id}
                  onClick={() => setEdgeId(edge.id)}
                >
                  <span className="rs-edge-number">{index + 1}</span>
                  <span>
                    {edge.from}{' '}
                    <strong>{edge.verb.replaceAll('_', ' ')}</strong> {edge.to}
                  </span>
                  <ArrowRight size={14} />
                </button>
              </li>
            ))}
          </ol>
          <div className="rs-quote" aria-live="polite">
            <Quote size={17} />
            <div>
              <blockquote>{selected.quote}</blockquote>
              <p>
                {selected.url ? (
                  <a href={selected.url} target="_blank" rel="noreferrer">
                    {selected.citation}
                  </a>
                ) : (
                  selected.citation
                )}
              </p>
            </div>
          </div>
        </>
      ) : (
        <p className="rs-empty">
          {words[0]} {words[1]}
        </p>
      )}
    </section>
  );
}
