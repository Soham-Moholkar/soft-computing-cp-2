import type { Entity, EntityType, GraphData, Relation } from '../../lib/types.js';
import type { GraphService } from '../contracts.js';
import { ApiClient } from './client.js';

interface ApiEntity {
  entity_id: string;
  canonical_name: string;
  entity_type: string;
  aliases: string[];
  description: string;
  source_chunks: string[];
  extraction_confidence: number;
  fuzzy_confidence: number;
  centrality_score: number;
  importance_score: number;
  embedding_reference: string | null;
}

interface ApiRelation {
  relation_id: string;
  source_entity: string;
  target_entity: string;
  relation_type: string;
  evidence: string;
  source_chunk: string;
  extraction_confidence: number;
  fuzzy_strength: number;
  semantic_strength: number;
  temporal_strength: number;
  final_weight: number;
}

export interface ApiGraphResponse {
  entities: ApiEntity[];
  relations: ApiRelation[];
  next_cursor: string | null;
  graph_version?: string;
}

const entityTypes = new Set<EntityType>([
  'Concept', 'Technology', 'Process', 'Domain', 'Organization', 'Person', 'Location', 'Event', 'Document', 'Product',
]);

function toEntityType(value: string): EntityType {
  return entityTypes.has(value as EntityType) ? value as EntityType : 'Domain';
}

function layout(index: number, total: number): { x: number; y: number } {
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / Math.max(total, 1);
  const radius = total <= 1 ? 0 : 210;
  return { x: Math.round(450 + radius * Math.cos(angle)), y: Math.round(320 + radius * Math.sin(angle)) };
}

export function mapGraphResponse(response: ApiGraphResponse): GraphData {
  const orderedEntities = [...response.entities].sort((left, right) => left.entity_id.localeCompare(right.entity_id));
  return {
    ...(response.graph_version ? { graphVersion: response.graph_version } : {}),
    entities: orderedEntities.map((entity, index): Entity => ({
      entityId: entity.entity_id,
      canonicalName: entity.canonical_name,
      entityType: toEntityType(entity.entity_type),
      aliases: entity.aliases,
      description: entity.description,
      sourceChunks: entity.source_chunks,
      extractionConfidence: entity.extraction_confidence,
      fuzzyConfidence: entity.fuzzy_confidence,
      centralityScore: entity.centrality_score,
      importanceScore: entity.importance_score,
      embeddingReference: entity.embedding_reference ?? '',
      ...layout(index, orderedEntities.length),
    })),
    relations: response.relations.map((relation): Relation => ({
      relationId: relation.relation_id,
      sourceEntity: relation.source_entity,
      targetEntity: relation.target_entity,
      relationType: relation.relation_type,
      evidence: relation.evidence,
      sourceChunk: relation.source_chunk,
      extractionConfidence: relation.extraction_confidence,
      fuzzyStrength: relation.fuzzy_strength,
      semanticStrength: relation.semantic_strength,
      temporalStrength: relation.temporal_strength,
      finalWeight: relation.final_weight,
    })),
  };
}

export function createRestGraphService(client = new ApiClient()): GraphService {
  async function getGraph(signal?: AbortSignal): Promise<GraphData> {
    const entities: ApiEntity[] = [];
    const relations: ApiRelation[] = [];
    let cursor: string | null = null;
    let version: string | undefined;
    const seen = new Set<string>();
    do {
      const query: string = cursor ? `?limit=500&cursor=${encodeURIComponent(cursor)}` : '?limit=500';
      const page = await client.get<ApiGraphResponse>(`/graph${query}`, signal);
      if (version && version !== page.graph_version) throw new Error('The graph changed while loading. Refresh the graph.');
      version = page.graph_version;
      entities.push(...page.entities);
      relations.push(...page.relations);
      cursor = page.next_cursor;
      if (cursor && seen.has(cursor)) throw new Error('Graph pagination did not advance.');
      if (cursor) seen.add(cursor);
    } while (cursor);
    // Entity pages are induced subgraphs; separately fetch all edges, including cross-page ones.
    if (version?.startsWith('graph-sqlite-')) {
      cursor = null; seen.clear(); relations.length = 0;
      do {
        const page: { relations: ApiRelation[]; graph_version: string; next_cursor: string | null } =
          await client.get(`/graph/relations?limit=500${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`, signal);
        if (page.graph_version !== version) throw new Error('The graph changed while loading. Refresh the graph.');
        relations.push(...page.relations);
        cursor = page.next_cursor;
        if (cursor && seen.has(cursor)) throw new Error('Relation pagination did not advance.');
        if (cursor) seen.add(cursor);
      } while (cursor);
    }
    return mapGraphResponse({ entities, relations, next_cursor: null, graph_version: version });
  }
  return {
    getGraph,
    async shortestPath(sourceId, targetId, options = {}) {
      const result = await client.post<{ nodes: ApiEntity[] }>('/graph/path', { source_entity: sourceId, target_entity: targetId, max_hops: 6, directed: false, minimum_confidence: options.minimumConfidence ?? 0, relation_types: options.relationTypes ?? [] });
      return result.nodes.map((entity) => entity.entity_id);
    },
    async build(documentIds, options = {}) {
      const result = await client.post<{
        graph_version: string; added_nodes: number; updated_nodes: number; removed_nodes: number;
        added_relations: number; updated_relations: number; removed_relations: number;
        review_count: number; changed: boolean; dry_run: boolean; warnings: string[];
      }>('/graph/build', { document_ids: documentIds, dry_run: options.dryRun ?? false, entity_threshold: options.entityThreshold ?? 0.8, relation_threshold: options.relationThreshold ?? 0.75 });
      return { graphVersion: result.graph_version, addedNodes: result.added_nodes, updatedNodes: result.updated_nodes,
        removedNodes: result.removed_nodes, addedRelations: result.added_relations, updatedRelations: result.updated_relations,
        removedRelations: result.removed_relations, reviewCount: result.review_count, changed: result.changed,
        dryRun: result.dry_run, warnings: result.warnings };
    },
    async documents() {
      const result = await client.get<Array<{ document_id: string; name: string; built: boolean; accepted_mentions: number; accepted_relations: number; review_count: number }>>('/graph/documents');
      return result.map((item) => ({ documentId: item.document_id, name: item.name, built: item.built, acceptedMentions: item.accepted_mentions, acceptedRelations: item.accepted_relations, reviewCount: item.review_count }));
    },
    async extraction(documentId) {
      const result = await client.get<{
        mentions: Array<{ surface_form: string; canonical_name: string; source_chunk: string; start_offset: number; end_offset: number; extraction_confidence: number; accepted: boolean }>;
        relation_candidates: Array<{ evidence: string; relation_type: string; source_chunk: string; extraction_confidence: number; accepted: boolean; reason: string }>;
      }>(`/graph/documents/${encodeURIComponent(documentId)}`);
      return { mentions: result.mentions.map((item) => ({ surface: item.surface_form, canonicalName: item.canonical_name, chunkId: item.source_chunk, start: item.start_offset, end: item.end_offset, confidence: item.extraction_confidence, accepted: item.accepted })),
        candidates: result.relation_candidates.map((item) => ({ evidence: item.evidence, relationType: item.relation_type, chunkId: item.source_chunk, confidence: item.extraction_confidence, accepted: item.accepted, reason: item.reason })) };
    },
    async entityDetail(entityId) {
      const result = await client.get<{ entity: ApiEntity; graph_version: string; evidence: Array<{ chunk_id: string; document_id: string; document_name: string; text: string; source_location: Record<string, string | number> }> }>(`/graph/entity/${encodeURIComponent(entityId)}`);
      return { canonicalName: result.entity.canonical_name, graphVersion: result.graph_version, evidence: result.evidence.map((item) => ({ chunkId: item.chunk_id, documentId: item.document_id, documentName: item.document_name, text: item.text, location: item.source_location })) };
    },
    async removeDocument(documentId) { await client.delete(`/graph/documents/${encodeURIComponent(documentId)}`); },
  };
}
