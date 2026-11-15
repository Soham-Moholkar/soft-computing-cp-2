import { createRestIngestionService } from '@/services/api/ingestion-service';
import { createRestRetrievalService } from '@/services/api/retrieval-service';
import {
  workspaceClient,
  type WorkspaceSummary,
} from '@/services/api/workspace-service';
import type { SourceType } from '@/lib/types';

export const samplePath = '/demo/ward-handoff-procedure.txt';
export const sampleName = 'ward-handoff-procedure.txt';
export const exampleQuestions = [
  'How does Care Handoff use Discharge Checklist?',
  'How is Referral Queue related to Procedure Library?',
  'What is the lunch menu on Mars?',
];
export const recognizedConcepts = [
  'Care Handoff',
  'Care Coordinator',
  'Discharge Checklist',
  'Evidence Review',
  'Follow Up Plan',
  'Medication Reconciliation',
  'Procedure Library',
  'Referral Queue',
];
const domain = 'care-evidence-operations';
const client = workspaceClient('healthcare');
export const ingestion = createRestIngestionService(client);
export const retrieval = createRestRetrievalService(client);
export const fileAccept = '.txt,.md,.markdown,.pdf,.docx,.csv,.json';

export type Location = Record<string, string | number>;
export interface Mention {
  entity_id: string;
  canonical_name: string;
  surface_form: string;
  source_chunk: string;
  source_location: Location;
  extraction_confidence: number;
  accepted: boolean;
}
export interface Candidate {
  candidate_id: string;
  source_entity: string;
  target_entity: string;
  relation_type: string;
  source_chunk: string;
  evidence: string;
  extraction_confidence: number;
  accepted: boolean;
  reason: string;
}
export interface Extraction {
  graph_version: string;
  configuration: {
    entity_threshold: number;
    relation_threshold: number;
  } | null;
  mentions: Mention[];
  relation_candidates: Candidate[];
}

export async function loadSources(signal?: AbortSignal) {
  const summary = await client.get<WorkspaceSummary>(
    '/workspace/summary',
    signal,
  );
  return summary.documents.filter(
    (doc) => doc.domain === domain && doc.processing_status === 'completed',
  );
}

export function loadExtraction(id: string, signal?: AbortSignal) {
  return client.get<Extraction>(
    `/graph/documents/${encodeURIComponent(id)}`,
    signal,
  );
}

export function buildGraph(id: string, signal?: AbortSignal) {
  return client.post<{ warnings: string[] }>(
    '/graph/build',
    {
      document_ids: [id],
      extraction_configuration_version: 'healthcare-extractor-2',
      entity_threshold: 0.8,
      relation_threshold: 0.75,
    },
    signal,
  );
}

export function uploadSource(
  file: File,
  signal: AbortSignal,
  progress: (value: number) => void,
) {
  const suffix = file.name.split('.').at(-1)?.toLowerCase() ?? '';
  const markdown = suffix === 'md' || suffix === 'markdown';
  if (!markdown && !['txt', 'pdf', 'docx', 'csv', 'json'].includes(suffix)) {
    throw new Error(
      'Choose a TXT, Markdown, text PDF, DOCX, CSV or JSON file.',
    );
  }
  if (!file.size)
    throw new Error('The file is empty. Choose a file containing text.');
  if (file.size > 10 * 1024 * 1024)
    throw new Error('Choose a file up to 10 MiB.');
  return ingestion.process({
    name: file.name,
    file: markdown
      ? new File([file], `${file.name}.txt`, { type: 'text/plain' })
      : file,
    sourceType: (markdown ? 'txt' : suffix) as SourceType,
    domain,
    signal,
    onProgress: (job) => progress(job.progress),
  });
}

export function sourceLocation(location?: Location) {
  if (!location) return 'Source passage';
  if (location.page !== undefined) return `Page ${location.page}`;
  if (location.row !== undefined) return `Row ${location.row}`;
  if (location.json_path !== undefined) return `JSON ${location.json_path}`;
  if (location.paragraph !== undefined)
    return `Paragraph ${location.paragraph}`;
  if (location.section !== undefined) return `Section ${location.section}`;
  return (
    Object.entries(location)
      .map(([key, value]) => `${key.replaceAll('_', ' ')} ${value}`)
      .join(' · ') || 'Source passage'
  );
}

export function graphFromSource(extraction: Extraction | null) {
  const concepts = new Map<string, Mention>();
  for (const mention of extraction?.mentions ?? []) {
    if (mention.accepted && !concepts.has(mention.entity_id))
      concepts.set(mention.entity_id, mention);
  }
  const relations = new Map<string, Candidate>();
  const review: Candidate[] = [];
  for (const candidate of extraction?.relation_candidates ?? []) {
    if (candidate.accepted) {
      const key = [
        candidate.source_entity,
        candidate.relation_type,
        candidate.target_entity,
      ].join('/');
      if (!relations.has(key)) relations.set(key, candidate);
    } else {
      review.push(candidate);
    }
  }
  return {
    concepts: [...concepts.values()].sort((a, b) =>
      a.canonical_name.localeCompare(b.canonical_name),
    ),
    edges: [...relations.values()],
    review,
  };
}
