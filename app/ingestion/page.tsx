'use client';
import { useEffect, useRef, useState } from 'react';
import Link from '@/components/common/app-link';
import {
  Check,
  FileJson,
  FileSpreadsheet,
  FileText,
  Globe,
  LoaderCircle,
  Play,
  Upload,
  WandSparkles,
} from 'lucide-react';
import type { SourceType } from '@/lib/types';
import type {
  IngestionProcessResult,
  IngestionProgress,
  StoredDocument,
} from '@/services/contracts';
import { serviceMode, services } from '@/services';
import { PageHeader } from '@/components/common/page-header';
import { EducationPanel } from '@/components/common/education-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
const sources: Array<{
  type: SourceType;
  label: string;
  hint: string;
  icon: typeof FileText;
}> = [
  { type: 'txt', label: 'TXT', hint: 'UTF-8 text', icon: FileText },
  { type: 'pdf', label: 'PDF', hint: 'Text documents', icon: FileText },
  { type: 'docx', label: 'DOCX', hint: 'Word paragraph/table text', icon: FileText },
  {
    type: 'csv',
    label: 'CSV',
    hint: 'Rows with headers',
    icon: FileSpreadsheet,
  },
  { type: 'json', label: 'JSON', hint: 'Objects or arrays', icon: FileJson },
  {
    type: 'paste',
    label: 'Paste text',
    hint: 'Direct input',
    icon: WandSparkles,
  },
  { type: 'url', label: 'URL', hint: 'Public HTTPS source', icon: Globe },
  {
    type: 'sample',
    label: 'Sample dataset',
    hint: 'Course overview',
    icon: Upload,
  },
];
export default function IngestionPage() {
  const [sourceType, setSourceType] = useState<SourceType>('sample');
  const [name, setName] = useState('soft-computing-overview.txt');
  const [domain, setDomain] = useState('Soft Computing');
  const [paste, setPaste] = useState(
    'Particle Swarm Optimization tunes retrieval weights while Ant Colony Optimization explores multi-hop paths in a Knowledge Graph.',
  );
  const [file, setFile] = useState<File | null>(null);
  const [chunkSize, setChunkSize] = useState(400);
  const [chunkOverlap, setChunkOverlap] = useState(64);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<IngestionProgress | null>(null);
  const [result, setResult] = useState<IngestionProcessResult | null>(null);
  const [document, setDocument] = useState<StoredDocument | null>(null);
  const [jobs, setJobs] = useState<IngestionProgress[]>([]);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const isFile = ['txt', 'pdf', 'docx', 'csv', 'json'].includes(sourceType);
  useEffect(() => {
    let active = true;
    services.ingestion
      .listJobs?.()
      .then((recent) => {
        if (active) setJobs(recent);
      })
      .catch(() => {
        if (active)
          setError(
            'Recent jobs could not be loaded. Check the backend connection.',
          );
      });
    return () => {
      active = false;
      controller.current?.abort();
    };
  }, []);
  async function refreshJobs() {
    try {
      if (services.ingestion.listJobs)
        setJobs(await services.ingestion.listJobs());
    } catch (caught) {
      setError(
        (existing) =>
          existing ||
          (caught instanceof Error
            ? caught.message
            : 'Recent jobs could not be refreshed.'),
      );
    }
  }
  async function inspectDocument(documentId: string, offset = 0) {
    try {
      if (services.ingestion.getDocument)
        setDocument(await services.ingestion.getDocument(documentId, offset));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The stored document could not be loaded.',
      );
    }
  }
  async function runPipeline() {
    setError('');
    if (!name.trim() || !domain.trim()) {
      setError('Provide a source name and domain.');
      return;
    }
    if (sourceType === 'paste' && !paste.trim()) {
      setError('Paste text cannot be blank.');
      return;
    }
    if (serviceMode === 'api' && isFile && !file) {
      setError('Choose a file to upload.');
      return;
    }
    if (
      !Number.isInteger(chunkSize) ||
      !Number.isInteger(chunkOverlap) ||
      chunkSize < 1 ||
      chunkSize > 2000 ||
      chunkOverlap < 0 ||
      chunkOverlap > 256 ||
      chunkOverlap >= chunkSize
    ) {
      setError(
        'Use a chunk size of 1–2000 words and overlap of 0–256 words smaller than the chunk size.',
      );
      return;
    }
    setRunning(true);
    setResult(null);
    setDocument(null);
    setProgress(null);
    controller.current = new AbortController();
    try {
      const response = await services.ingestion.process({
        name,
        sourceType,
        domain,
        chunkSize,
        chunkOverlap,
        ...(sourceType === 'paste' ? { text: paste } : {}),
        ...(sourceType === 'url' ? { sourceUri: name } : {}),
        ...(file ? { file } : {}),
        signal: controller.current.signal,
        onProgress: setProgress,
      });
      setResult(response);
      await inspectDocument(response.document.documentId);
    } catch (caught) {
      if (!controller.current?.signal.aborted)
        setError(
          caught instanceof Error
            ? caught.message
            : 'The ingestion service could not process this source.',
        );
    } finally {
      setRunning(false);
      await refreshJobs();
    }
  }
  async function continueJob(job: IngestionProgress) {
    if (!services.ingestion.retry || !services.ingestion.resume) return;
    setRunning(true);
    setError('');
    setResult(null);
    setDocument(null);
    controller.current = new AbortController();
    try {
      const completed =
        job.status === 'failed'
          ? await services.ingestion.retry(
              job.jobId,
              setProgress,
              controller.current.signal,
            )
          : await services.ingestion.resume(
              job.jobId,
              setProgress,
              controller.current.signal,
            );
      await inspectDocument(completed.documentId);
    } catch (caught) {
      if (!controller.current.signal.aborted)
        setError(
          caught instanceof Error
            ? caught.message
            : 'The job could not be continued.',
        );
    } finally {
      setRunning(false);
      await refreshJobs();
    }
  }
  const stages = progress?.stages ?? result?.stageDurations ?? [];
  return (
    <>
      <PageHeader
        eyebrow="Knowledge graph creation"
        title="Data ingestion laboratory"
        description={
          serviceMode === 'api'
            ? 'Upload documents, parse their contents and inspect saved evidence chunks. Your documents and job history are retained between sessions.'
            : 'Explore the ingestion workflow with simulated teaching data. Start in API mode to process and save real documents.'
        }
        icon={Upload}
        actions={
          <Button onClick={runPipeline} disabled={running}>
            {running ? <LoaderCircle className="animate-spin" /> : <Play />}{' '}
            Process source
          </Button>
        }
      />
      <section className="grid gap-5 xl:grid-cols-[1fr_440px]">
        <Card className="border-slate-200 p-6 shadow-none">
          <div>
            <h2 className="text-lg font-semibold">
              1. Select an information source
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {serviceMode === 'api'
                ? 'Files up to 10 MiB. PDF: up to 200 pages. DOCX: body paragraphs and table text only. Scans and images need OCR; legacy .doc and macro-enabled files are unsupported.'
                : 'Mock mode demonstrates the workflow with simulated results.'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {sources.map(({ type, label, hint, icon: Icon }) => (
              <button
                type="button"
                disabled={running}
                key={type}
                onClick={() => {
                  setSourceType(type);
                  setFile(null);
                  setName(
                    type === 'sample'
                      ? 'soft-computing-overview.txt'
                      : type === 'url'
                        ? ''
                        : 'course-notes.' + (type === 'paste' ? 'txt' : type),
                  );
                }}
                className={
                  'rounded-xl border p-4 text-left transition disabled:opacity-50 ' +
                  (sourceType === type
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/10'
                    : 'bg-card hover:border-slate-300')
                }
              >
                <Icon className="size-5 text-primary" />
                <p className="mt-3 text-sm font-semibold">{label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
              </button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label
              className="space-y-2 text-sm font-medium"
              htmlFor="source-name"
            >
              {sourceType === 'url' ? 'Source URL' : 'Document name'}
              <Input
                id="source-name"
                disabled={running}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={
                  sourceType === 'url'
                    ? 'https://example.com/article'
                    : 'course-notes.txt'
                }
              />
            </label>
            <label
              className="space-y-2 text-sm font-medium"
              htmlFor="source-domain"
            >
              Domain
              <Input
                id="source-domain"
                disabled={running}
                value={domain}
                onChange={(event) => setDomain(event.target.value)}
              />
            </label>
          </div>
          {sourceType === 'paste' && (
            <label
              htmlFor="pasted-text"
              className="space-y-2 text-sm font-medium"
            >
              Pasted text
              <Textarea
                id="pasted-text"
                disabled={running}
                value={paste}
                onChange={(event) => setPaste(event.target.value)}
                className="min-h-32"
                maxLength={100000}
              />
            </label>
          )}
          {isFile && (
            <label
              className="space-y-2 text-sm font-medium"
              htmlFor="source-file"
            >
              Choose a {sourceType.toUpperCase()} file
              <input
                id="source-file"
                className="block w-full rounded-lg border p-3 text-sm"
                type="file"
                disabled={running}
                accept={'.' + sourceType}
                onChange={(event) => {
                  const selected = event.target.files?.[0] ?? null;
                  setFile(selected);
                  if (selected) setName(selected.name);
                }}
              />
              {file && (
                <span className="block text-xs text-muted-foreground">
                  {file.name} · {(file.size / 1024).toFixed(1)} KiB
                </span>
              )}
            </label>
          )}
          <div className="grid grid-cols-2 gap-4">
            <label
              htmlFor="chunk-size"
              className="space-y-2 text-sm font-medium"
            >
              Words per chunk
              <Input
                id="chunk-size"
                type="number"
                min={1}
                max={2000}
                disabled={running}
                value={chunkSize}
                onChange={(event) => setChunkSize(Number(event.target.value))}
              />
            </label>
            <label
              htmlFor="chunk-overlap"
              className="space-y-2 text-sm font-medium"
            >
              Overlapping words
              <Input
                id="chunk-overlap"
                type="number"
                min={0}
                max={256}
                disabled={running}
                value={chunkOverlap}
                onChange={(event) =>
                  setChunkOverlap(Number(event.target.value))
                }
              />
            </label>
          </div>
        </Card>
        <Card className="border-slate-200 p-6 shadow-none">
          <div className="flex items-start justify-between">
            <h2 className="text-lg font-semibold">2. Processing progress</h2>
            <Badge variant="outline">
              {serviceMode === 'api' ? 'Live job' : 'Demo'}
            </Badge>
          </div>
          <div aria-live="polite" className="space-y-4">
            {progress && (
              <p className="text-sm">
                {progress.status} · {progress.progress}%
              </p>
            )}
            {stages.map((stage, index) => {
              const active =
                running &&
                index === stages.length - 1 &&
                progress?.status !== 'completed' &&
                progress?.status !== 'failed';
              return (
                <div
                  key={stage.stage + index}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    {active ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    <span className="text-sm">{stage.stage}</span>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {stage.durationMs} ms
                  </span>
                </div>
              );
            })}
            {!stages.length && (
              <p className="text-sm text-muted-foreground">
                Process a source to see its job history.
              </p>
            )}
          </div>
          {result && (
            <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
              <p className="font-semibold">
                {serviceMode === 'api'
                  ? `${result.chunkCount ?? 0} evidence chunks saved`
                  : 'Demo pipeline completed'}
              </p>
              {result.warnings.map((warning) => (
                <p key={warning} className="text-xs leading-5">
                  {warning}
                </p>
              ))}
              {serviceMode === 'api' && (
                <Link
                  href={`/graph?document=${encodeURIComponent(result.document.documentId)}`}
                  className="inline-block text-sm font-semibold underline"
                >
                  Build knowledge graph
                </Link>
              )}
            </div>
          )}
          <p className="text-xs leading-5 text-muted-foreground">
            This step prepares source evidence. Entity extraction and graph
            construction are the next stage.
          </p>
        </Card>
      </section>
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      {serviceMode === 'api' && (
        <Card className="border-slate-200 p-6 shadow-none">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent jobs</h2>
            <Button variant="outline" onClick={refreshJobs} disabled={running}>
              Refresh
            </Button>
          </div>
          {!jobs.length && (
            <p className="text-sm text-muted-foreground">
              Your submitted jobs will appear here.
            </p>
          )}
          {jobs.map((job) => (
            <div
              key={job.jobId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <p className="text-sm">
                  {job.status} · {job.progress}%
                </p>
                <p
                  className="max-w-[420px] truncate font-mono text-xs text-muted-foreground"
                  title={job.jobId}
                >
                  {job.jobId}
                </p>
                {job.error && (
                  <p className="text-xs text-red-700">{job.error}</p>
                )}
              </div>
              <Button
                variant="outline"
                disabled={running}
                onClick={() =>
                  job.status === 'completed'
                    ? inspectDocument(job.documentId)
                    : continueJob(job)
                }
              >
                {job.status === 'completed'
                  ? 'View chunks'
                  : job.status === 'failed'
                    ? 'Retry'
                    : 'Continue job'}
              </Button>
            </div>
          ))}
        </Card>
      )}
      {document && (
        <Card className="border-slate-200 p-6 shadow-none">
          <div>
            <h2 className="text-lg font-semibold">
              Saved evidence: {document.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {document.totalChunks} chunks · source locations refer to the
              original page or record; word overlap preserves context.
            </p>
          </div>
          {document.chunks.map((chunk) => (
            <div
              key={chunk.chunkId}
              className="space-y-2 rounded-lg border p-4"
            >
              <p className="text-xs text-muted-foreground">
                {chunk.tokenCount} words ·{' '}
                {Object.entries(chunk.sourceLocation)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(' · ')}
              </p>
              <p className="whitespace-pre-wrap break-words text-sm leading-6">
                {chunk.text}
              </p>
            </div>
          ))}
          {serviceMode === 'api' && (
            <Link
              href={`/graph?document=${encodeURIComponent(document.documentId)}`}
              className="text-sm font-semibold underline"
            >
              Next: build this document’s graph, then ask a question
            </Link>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => inspectDocument(document.documentId, 0)}
            >
              First page
            </Button>
            {document.nextOffset !== null && (
              <Button
                variant="outline"
                onClick={() =>
                  inspectDocument(document.documentId, document.nextOffset ?? 0)
                }
              >
                Next chunks
              </Button>
            )}
          </div>
        </Card>
      )}
      <EducationPanel
        title="Ingestion and source evidence"
        items={{
          'What is this?':
            'Conversion of documents into durable evidence chunks with source references.',
          'Why is it being used?':
            'Graph facts and retrieved answers must be traceable to source content.',
          'How does it work?':
            'Upload or fetch, parse, normalize, chunk with overlap and store.',
          'Where is it used in SoftGraph?':
            'Before entity extraction, graph construction and retrieval.',
          Inputs:
            'TXT, text PDFs, DOCX paragraph/table text, CSV, JSON, pasted text, public HTTPS or the course sample.',
          Outputs: 'Stored documents, evidence chunks and processing history.',
          Parameters: 'Chunk size, overlap and source limits.',
          Example:
            'A PDF paragraph becomes a chunk that retains its page number.',
        }}
      />
    </>
  );
}
