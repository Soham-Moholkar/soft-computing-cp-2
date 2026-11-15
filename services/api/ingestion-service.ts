import type { DocumentRecord } from '../../lib/types.js';
import type {
  IngestionProcessResult,
  IngestionService,
  IngestionProgress,
  IngestionProcessInput,
} from '../contracts.js';
import { ApiClient } from './client.js';
import { pollJob } from './polling.js';

interface ApiIngestionAccepted {
  schema_version: string;
  job_id: string;
  document_id: string;
  status: DocumentRecord['processingStatus'];
  progress: number;
  created_at: string;
}

interface ApiIngestionJob extends ApiIngestionAccepted {
  updated_at: string;
  stages: Array<{ stage: string; progress: number; recorded_at: string }>;
  warnings: string[];
  final_counts: { chunks: number; entities: number; relations: number };
  error?: string | null;
}

type ApiIngestionPayload = {
  source_type: DocumentRecord['sourceType'];
  name: string;
  domain: string;
  chunk_size?: number;
  chunk_overlap?: number;
  text?: string;
  source_uri?: string;
};

export function mapIngestionPayload(
  input: Parameters<IngestionService['process']>[0],
): ApiIngestionPayload {
  const payload: ApiIngestionPayload = {
    source_type: input.sourceType,
    name: input.name,
    domain: input.domain,
    ...(input.chunkSize === undefined ? {} : { chunk_size: input.chunkSize }),
    ...(input.chunkOverlap === undefined
      ? {}
      : { chunk_overlap: input.chunkOverlap }),
  };
  if (input.sourceType === 'paste') {
    if (!input.text?.trim()) throw new Error('Paste text cannot be blank.');
    payload.text = input.text;
  }
  if (input.sourceType === 'url') {
    if (!input.sourceUri?.trim()) throw new Error('A source URL is required.');
    payload.source_uri = input.sourceUri;
  }
  return payload;
}

export function mapCompletedIngestion(
  input: Parameters<IngestionService['process']>[0],
  accepted: ApiIngestionAccepted,
  job: ApiIngestionJob,
): IngestionProcessResult {
  return {
    document: {
      documentId: accepted.document_id,
      name: input.name,
      sourceType: input.sourceType,
      ...(input.sourceUri ? { sourceUri: input.sourceUri } : {}),
      domain: input.domain,
      timestamp: accepted.created_at,
      metadata: {
        backend: true,
        schemaVersion: accepted.schema_version,
        chunks: job.final_counts.chunks,
      },
      processingStatus: job.status,
    },
    stageDurations: mapProgress(job).stages,
    extractedEntities: job.final_counts.entities,
    extractedRelations: job.final_counts.relations,
    warnings: job.warnings,
    jobId: job.job_id,
    chunkCount: job.final_counts.chunks,
  };
}

export function mapProgress(job: ApiIngestionJob): IngestionProgress {
  return {
    jobId: job.job_id,
    documentId: job.document_id,
    status: job.status,
    progress: job.progress,
    ...(job.error ? { error: job.error } : {}),
    stages: job.stages.map((stage, index) => ({
      stage: stage.stage.replace(/\b\w/g, (letter) => letter.toUpperCase()),
      durationMs: Math.max(
        0,
        Date.parse(job.stages[index + 1]?.recorded_at ?? job.updated_at) -
          Date.parse(stage.recorded_at),
      ),
    })),
  };
}

export function createRestIngestionService(
  client = new ApiClient(),
): IngestionService {
  async function poll(
    jobId: string,
    onProgress?: IngestionProcessInput['onProgress'],
    signal?: AbortSignal,
  ): Promise<ApiIngestionJob> {
    return pollJob({
      load: (pollSignal) =>
        client.get<ApiIngestionJob>(
          `/ingestion/jobs/${encodeURIComponent(jobId)}`,
          pollSignal,
        ),
      onProgress: (job) => onProgress?.(mapProgress(job)),
      signal,
      timeoutMessage:
        'The job is still processing. Continue it from the recent jobs list.',
      failureMessage: 'Ingestion failed.',
    });
  }
  return {
    async process(input) {
      let accepted: ApiIngestionAccepted;
      if (['txt', 'pdf', 'docx', 'csv', 'json'].includes(input.sourceType)) {
        if (!input.file) throw new Error('Choose a file to upload.');
        if (input.file.size > 10 * 1024 * 1024)
          throw new Error('Files must be 10 MiB or smaller.');
        const form = new FormData();
        form.set('file', input.file);
        form.set('source_type', input.sourceType);
        form.set('name', input.name);
        form.set('domain', input.domain);
        form.set('chunk_size', String(input.chunkSize ?? 400));
        form.set('chunk_overlap', String(input.chunkOverlap ?? 64));
        accepted = await client.postForm<ApiIngestionAccepted>(
          '/ingestion/upload/file',
          form,
          input.signal,
        );
      } else {
        accepted = await client.post<ApiIngestionAccepted>(
          '/ingestion/upload',
          mapIngestionPayload(input),
          input.signal,
        );
      }
      const job = await poll(accepted.job_id, input.onProgress, input.signal);
      return mapCompletedIngestion(input, accepted, job);
    },
    async listJobs() {
      return (await client.get<ApiIngestionJob[]>('/ingestion/jobs')).map(
        mapProgress,
      );
    },
    async resume(jobId, onProgress, signal) {
      return mapProgress(await poll(jobId, onProgress, signal));
    },
    async retry(jobId, onProgress, signal) {
      await client.post(
        `/ingestion/jobs/${encodeURIComponent(jobId)}/retry`,
        {},
        signal,
      );
      return mapProgress(await poll(jobId, onProgress, signal));
    },
    async getDocument(documentId, offset = 0) {
      const detail = await client.get<{
        document: { document_id: string; name: string };
        total_chunks: number;
        next_offset: number | null;
        chunks: Array<{
          chunk_id: string;
          text: string;
          token_count: number;
          source_location: Record<string, string | number>;
        }>;
      }>(
        `/ingestion/documents/${encodeURIComponent(documentId)}?offset=${offset}&limit=20`,
      );
      return {
        documentId: detail.document.document_id,
        name: detail.document.name,
        totalChunks: detail.total_chunks,
        nextOffset: detail.next_offset,
        chunks: detail.chunks.map((chunk) => ({
          chunkId: chunk.chunk_id,
          text: chunk.text,
          tokenCount: chunk.token_count,
          sourceLocation: chunk.source_location,
        })),
      };
    },
  };
}
