import { ApiClient, resolveApiBaseUrl } from './client.js';
import type { ApiRetrievalResult } from './retrieval-service.js';
import { pollJob } from './polling.js';
export type WorkspaceId =
  | 'healthcare'
  | 'agriculture'
  | 'engineering'
  | 'finance'
  | 'personal'
  | 'course';
export interface WorkspaceProfile {
  workspace_id: WorkspaceId;
  name: string;
  category: string;
  description: string;
  questions: string[];
  extraction_version: string;
  example_kind: 'theoretical';
  policy: { name: string; weights: number[]; version: string; focus: string };
  default_preferences: WorkspacePreferences;
}
export interface Session {
  authenticated: boolean;
  local_mode: boolean;
  actor: {
    user: string;
    role: 'editor' | 'reader';
    workspaces: WorkspaceId[];
  } | null;
}
export interface WorkspacePreferences {
  mode: 'lexical' | 'hybrid' | 'fuzzy' | 'graph';
  top_k: number;
  max_hops: number;
  view: 'cards' | 'list';
  ranking_profile?: 'balanced' | 'domain';
}
export interface WorkspaceDocument {
  document_id: string;
  name: string;
  source_type: string;
  domain: string;
  timestamp: string;
  processing_status: string;
  graph_version: string;
  byte_count: number;
}
export interface WorkspaceSummary {
  profile: WorkspaceProfile;
  counts: Record<
    | 'sources'
    | 'chunks'
    | 'concepts'
    | 'relations'
    | 'retained_queries'
    | 'review_candidates'
    | 'pending_jobs'
    | 'failed_jobs',
    number
  >;
  documents: WorkspaceDocument[];
  recent_queries: ApiRetrievalResult[];
  graph_version: string;
  ranking: string;
  ranker_warning?: string | null;
}
export interface SourceDetail {
  document: WorkspaceDocument;
  chunks: Array<{
    chunk_id: string;
    text: string;
    source_location: Record<string, string | number>;
  }>;
  total_chunks: number;
}
export interface AcceptedJob {
  job_id: string;
  document_id: string;
  status: string;
}

export function workspaceClient(
  workspace: WorkspaceId,
  options?: { baseUrl?: string; fetchImplementation?: typeof fetch },
) {
  if (
    ![
      'healthcare',
      'agriculture',
      'engineering',
      'finance',
      'personal',
      'course',
    ].includes(workspace)
  )
    throw new Error('Unknown workspace');
  const base = resolveApiBaseUrl(options?.baseUrl);
  const scoped =
    /^https?:\/\//.test(base) && base.endsWith('/api')
      ? `${base.slice(0, -4)}/workspaces/${workspace}/api`
      : `${base}/workspaces/${workspace}`;
  return new ApiClient({ ...options, baseUrl: scoped });
}
export async function waitForSource(
  client: ApiClient,
  accepted: AcceptedJob,
  signal: AbortSignal,
) {
  await pollJob({
    load: (pollSignal) =>
      client.get<{ status: string; error: string | null }>(
        `/ingestion/jobs/${encodeURIComponent(accepted.job_id)}`,
        pollSignal,
      ),
    signal,
    timeoutMessage:
      'Source is still processing. Reopen Sources to check its status.',
    failureMessage: 'Source processing failed.',
  });
  return accepted.document_id;
}
