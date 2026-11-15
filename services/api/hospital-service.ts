import { workspaceClient } from './workspace-service.js';
export interface HospitalPatient {
  patient_id: string;
  patient_label: string;
  encounters: number;
  last_recorded_at: string;
}
export interface RecordSource {
  import_id: string;
  filename: string;
  location: Record<string, string | number>;
}
export interface HospitalEncounter {
  patient_id: string;
  encounter_id: string;
  recorded_at: string;
  patient_label: string;
  observations: Array<{ name: string; value: string | number; unit: string }>;
  conditions: Array<{
    name: string;
    status: 'confirmed' | 'suspected' | 'negated' | 'historical';
    detail: string;
  }>;
  care_plan: string;
  prognosis_note: string;
  notes: string;
  raw_record: Record<string, unknown>;
  source: RecordSource;
}
export interface HospitalDetail {
  patient_id: string;
  patient_label: string;
  encounters: HospitalEncounter[];
  evidence_count: number;
  total_encounters: number;
  offset: number;
  limit: number;
  attachment_count: number;
  graph: {
    nodes: Array<{
      id: string;
      label: string;
      kind: string;
      evidence_id?: string;
    }>;
    edges: Array<{ source: string; target: string; label: string }>;
    shown_encounters: number;
    description: string;
  };
}
export interface HospitalEvidence {
  evidence_id: string;
  encounter_id: string;
  recorded_at: string;
  field: string;
  text: string;
  kind: string;
  matched_terms: string[];
  score: number;
  truncated: boolean;
  source: RecordSource;
}
export interface HospitalQueryResult {
  patient_id: string;
  status: 'evidence' | 'not_recorded';
  message: string;
  evidence: HospitalEvidence[];
}
const client = workspaceClient('healthcare');
export const hospitalService = {
  patients(search = '', offset = 0, signal?: AbortSignal) {
    return client.get<{
      patients: HospitalPatient[];
      total: number;
      offset: number;
      limit: number;
    }>(
      `/hospital/patients?search=${encodeURIComponent(search)}&offset=${offset}`,
      signal,
    );
  },
  detail(patientId: string, signal?: AbortSignal, offset = 0) {
    return client.get<HospitalDetail>(
      `/hospital/patients/${encodeURIComponent(patientId)}?offset=${offset}`,
      signal,
    );
  },
  documents(patientId: string, signal?: AbortSignal) {
    return client.get<{ documents: HospitalDocument[] }>(
      `/hospital/patients/${encodeURIComponent(patientId)}/documents`,
      signal,
    );
  },
  attach(patientId: string, file: File, signal?: AbortSignal) {
    const form = new FormData();
    form.set('file', file);
    return client.postForm<{ job_id: string }>(
      `/hospital/patients/${encodeURIComponent(patientId)}/documents`,
      form,
      signal,
    );
  },
  retryDocument(jobId: string, signal?: AbortSignal) {
    return client.post<{ job_id: string }>(
      `/ingestion/jobs/${encodeURIComponent(jobId)}/retry`,
      {},
      signal,
    );
  },
  import(file: File, table?: string, signal?: AbortSignal) {
    const form = new FormData();
    form.set('file', file);
    if (table) form.set('table', table);
    return client.postForm<{
      imported: number;
      unchanged: number;
      duplicate: boolean;
    }>('/hospital/import', form, signal);
  },
  inspect(file: File, signal?: AbortSignal) {
    const form = new FormData();
    form.set('file', file);
    return client.postForm<{ tables: string[] }>(
      '/hospital/inspect',
      form,
      signal,
    );
  },
  query(patientId: string, question: string, signal?: AbortSignal) {
    return client.post<HospitalQueryResult>(
      '/hospital/query',
      { patient_id: patientId, question, limit: 8 },
      signal,
    );
  },
  templateUrl(format: string) {
    return `/api/backend/workspaces/healthcare/hospital/template?format=${format}`;
  },
};

export interface HospitalDocument {
  document_id: string;
  job_id: string;
  name: string;
  source_type: string;
  status: string;
  progress: number;
  chunks: number;
  error: string | null;
  warnings: string[];
}

export function recordCitation(source: RecordSource, field?: string): string {
  const place = Object.entries(source.location)
    .map(([key, value]) => `${key}: ${value}`)
    .join(' · ');
  return `${source.filename} · ${place}${field ? ` · ${field}` : ''}`;
}
