import { ApiClient, resolveApiBaseUrl } from '@/services/api/client';
import { createRestIngestionService } from '@/services/api/ingestion-service';
import { createRestRetrievalService } from '@/services/api/retrieval-service';
import type { WorkspaceSummary } from '@/services/api/workspace-service';
import type { SourceType } from '@/lib/types';
import type { Extraction } from '@/components/care-evidence/source';

const client = new ApiClient({
  baseUrl: resolveApiBaseUrl() + '/workspaces/ration',
});
const ingestion = createRestIngestionService(client);
const retrieval = createRestRetrievalService(client);
const domain = 'ration-saathi-library';
const fileTypes = ['txt', 'md', 'markdown', 'pdf', 'docx', 'csv', 'json'];

export async function listSources() {
  const summary = await client.get<WorkspaceSummary>('/workspace/summary');
  return summary.documents.filter(
    (source) =>
      source.domain === domain && source.processing_status === 'completed',
  );
}
export async function readSource(id: string) {
  const [extraction, document] = await Promise.all([
    client.get<Extraction>(`/graph/documents/${encodeURIComponent(id)}`),
    ingestion.getDocument!(id),
  ]);
  return { extraction, document };
}
export async function build(id: string) {
  return client.post<{ warnings: string[]; changed: boolean }>('/graph/build', {
    document_ids: [id],
    extraction_configuration_version: 'ration-extractor-1',
    entity_threshold: 0.8,
    relation_threshold: 0.75,
  });
}
export async function upload(file: File, progress: (value: number) => void) {
  const suffix = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!fileTypes.includes(suffix))
    throw new Error(
      'Choose a TXT, Markdown, text PDF, DOCX, CSV or JSON file.',
    );
  if (file.size === 0) throw new Error('Choose a file containing text.');
  const markdown = suffix === 'md' || suffix === 'markdown';
  return ingestion.process({
    file: markdown
      ? new File([file], `${file.name}.txt`, { type: 'text/plain' })
      : file,
    name: file.name,
    sourceType: (markdown ? 'txt' : suffix) as SourceType,
    domain,
    onProgress: (job) => progress(job.progress),
  });
}
export async function askSource(id: string, query: string) {
  return retrieval.retrieve({
    query,
    documentId: id,
    topK: 5,
    maxHops: 4,
    mode: 'hybrid',
    rankingProfile: 'domain',
  });
}
export const acceptFiles = fileTypes.map((type) => '.' + type).join(',');
