import { ArrowUpRight, Network } from 'lucide-react';
import type { ApiGraphResponse } from '@/services/api/graph-service';

const positions = [
  [42, 32],
  [134, 22],
  [226, 38],
  [48, 104],
  [139, 118],
  [229, 107],
];

export function EnvironmentNetwork({
  graph,
  onOpen,
}: {
  graph: ApiGraphResponse | null;
  onOpen: () => void;
}) {
  const connected = new Set<string>();
  for (const relation of graph?.relations ?? []) {
    if (connected.size >= 6) break;
    if (connected.has(relation.source_entity) || connected.size < 6)
      connected.add(relation.source_entity);
    if (connected.has(relation.target_entity) || connected.size < 6)
      connected.add(relation.target_entity);
  }
  const entities = (graph?.entities ?? [])
    .filter((entity) => connected.has(entity.entity_id))
    .slice(0, 6);
  const coordinates = new Map(
    entities.map((entity, index) => [entity.entity_id, positions[index]]),
  );
  const relations = (graph?.relations ?? []).filter(
    (relation) =>
      coordinates.has(relation.source_entity) &&
      coordinates.has(relation.target_entity),
  );
  return (
    <button
      onClick={onOpen}
      className="environment-network group hidden w-64 shrink-0 rounded-2xl border p-4 text-left transition-transform hover:-translate-y-1 md:block"
      aria-label="Explore this environment's stored graph"
    >
      <span className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[.14em]">
        <span className="flex items-center gap-2">
          <Network className="size-3" /> Knowledge network
        </span>
        <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </span>
      {entities.length ? (
        <svg viewBox="0 0 270 147" className="mt-3 w-full" aria-hidden="true">
          {relations.map((relation) => {
            const from = coordinates.get(relation.source_entity)!;
            const to = coordinates.get(relation.target_entity)!;
            return (
              <line
                key={relation.relation_id}
                x1={from[0]}
                y1={from[1]}
                x2={to[0]}
                y2={to[1]}
                stroke="currentColor"
                strokeWidth="1"
                opacity=".25"
              />
            );
          })}
          {entities.map((entity, index) => (
            <g key={entity.entity_id}>
              <circle
                cx={positions[index][0]}
                cy={positions[index][1]}
                r="10"
                fill="currentColor"
                opacity=".08"
              />
              <circle
                cx={positions[index][0]}
                cy={positions[index][1]}
                r="3.5"
                fill="currentColor"
              />
              <text
                x={positions[index][0]}
                y={positions[index][1] + 22}
                textAnchor="middle"
                fill="currentColor"
                fontSize="8"
              >
                {entity.canonical_name.length > 18
                  ? entity.canonical_name.slice(0, 16) + '…'
                  : entity.canonical_name}
              </text>
            </g>
          ))}
        </svg>
      ) : (
        <span className="my-7 block text-xs leading-5 opacity-70">
          Your source connections will appear here as the graph grows.
        </span>
      )}
      <span className="mt-2 block border-t border-current/10 pt-3 text-[10px] opacity-70">
        {entities.length} concepts in preview · Open full graph
      </span>
    </button>
  );
}
