'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Check,
  ChevronRight,
  Database,
  Download,
  FileText,
  HeartPulse,
  LoaderCircle,
  Network,
  Search,
  Upload,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSession } from '@/components/auth/session-provider';
import {
  hospitalService,
  recordCitation,
  type HospitalDetail,
  type HospitalDocument,
  type HospitalPatient,
  type HospitalQueryResult,
} from '@/services/api/hospital-service';
import Link from '@/components/common/app-link';

const statusStyle = {
  confirmed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  suspected: 'bg-amber-50 text-amber-800 border-amber-200',
  negated: 'bg-rose-50 text-rose-800 border-rose-200',
  historical: 'bg-slate-100 text-slate-700 border-slate-200',
};
function dateLabel(value: string) {
  return value.slice(0, 10);
}
function errorText(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'The records request could not be completed.';
}

export default function HospitalPage() {
  const { session } = useSession();
  const canEdit = session?.local_mode || session?.actor?.role === 'editor';
  const [patients, setPatients] = useState<HospitalPatient[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState('');
  const [detail, setDetail] = useState<HospitalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [table, setTable] = useState('');
  const [inspecting, setInspecting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState('');
  const [question, setQuestion] = useState('');
  const [querying, setQuerying] = useState(false);
  const [result, setResult] = useState<HospitalQueryResult | null>(null);
  const [activeGraph, setActiveGraph] = useState<string | null>(null);
  const [encounterOffset, setEncounterOffset] = useState(0);
  const [newPatientId, setNewPatientId] = useState('');
  const [newPatientLabel, setNewPatientLabel] = useState('');
  const [creatingPatient, setCreatingPatient] = useState(false);
  const [documents, setDocuments] = useState<HospitalDocument[]>([]);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [attaching, setAttaching] = useState(false);
  const attachmentController = useRef<AbortController | null>(null);
  const queryController = useRef<AbortController | null>(null);
  const inspectController = useRef<AbortController | null>(null);
  const importController = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      hospitalService
        .patients(search, offset, controller.signal)
        .then((value) => {
          if (controller.signal.aborted) return;
          setPatients(value.patients);
          setTotal(value.total);
          setLoading(false);
        })
        .catch((caught) => {
          if (!controller.signal.aborted) {
            setError(errorText(caught));
            setLoading(false);
          }
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, offset, refresh]);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    hospitalService
      .detail(selected, controller.signal, encounterOffset)
      .then((value) => {
        if (!controller.signal.aborted) setDetail(value);
      })
      .catch((caught) => {
        if (!controller.signal.aborted) setError(errorText(caught));
      });
    return () => controller.abort();
  }, [selected, refresh, encounterOffset]);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      try {
        const next = await hospitalService.documents(
          selected,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setDocuments(next.documents);
        if (
          next.documents.some(
            (document) => !['completed', 'failed'].includes(document.status),
          )
        )
          timer = setTimeout(() => void load(), 2000);
      } catch (caught) {
        if (!controller.signal.aborted) setError(errorText(caught));
      }
    }
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [selected, refresh]);

  useEffect(
    () => () => {
      queryController.current?.abort();
      inspectController.current?.abort();
      importController.current?.abort();
      attachmentController.current?.abort();
    },
    [],
  );

  function selectPatient(id: string) {
    queryController.current?.abort();
    attachmentController.current?.abort();
    setAttaching(false);
    setDocumentFile(null);
    setDocuments([]);
    setEncounterOffset(0);
    setQuerying(false);
    setSelected(id);
    setDetail(null);
    setResult(null);
    setQuestion('');
    setActiveGraph(null);
    setError('');
  }
  async function createPatient(event: { preventDefault(): void }) {
    event.preventDefault();
    if (!newPatientId.trim()) return;
    setCreatingPatient(true);
    setError('');
    try {
      const entry = [
        {
          patient_id: newPatientId.trim(),
          patient_label: newPatientLabel.trim(),
          encounter_id: `registration-${crypto.randomUUID()}`,
          recorded_at: new Date().toISOString(),
          observations: [],
          conditions: [],
          care_plan: '',
          prognosis_note: '',
          notes:
            'Administrative patient registration entered manually. No clinical assessment recorded.',
        },
      ];
      const registration = new File(
        [JSON.stringify(entry)],
        'manual-patient-registration.json',
        { type: 'application/json' },
      );
      await hospitalService.import(registration);
      setRefresh((value) => value + 1);
      selectPatient(newPatientId.trim());
      setNewPatientId('');
      setNewPatientLabel('');
      setNotice(
        'Patient registered. Select a document to explicitly attach it to this patient.',
      );
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setCreatingPatient(false);
    }
  }
  async function attachDocument() {
    if (!documentFile || !selected) return;
    if (documentFile.size > 10 * 1024 * 1024) {
      setError('Attach a document of at most 10 MiB.');
      return;
    }
    const controller = new AbortController();
    attachmentController.current = controller;
    setAttaching(true);
    setError('');
    try {
      await hospitalService.attach(selected, documentFile, controller.signal);
      if (!controller.signal.aborted) {
        setRefresh((value) => value + 1);
        setNotice(
          `Document explicitly attached to ${selected}; parsing continues locally.`,
        );
        setDocumentFile(null);
      }
    } catch (caught) {
      if (!controller.signal.aborted) setError(errorText(caught));
    } finally {
      if (!controller.signal.aborted) setAttaching(false);
    }
  }
  async function retryDocument(jobId: string) {
    const controller = new AbortController();
    attachmentController.current = controller;
    setAttaching(true);
    setError('');
    try {
      await hospitalService.retryDocument(jobId, controller.signal);
      if (!controller.signal.aborted) setRefresh((value) => value + 1);
    } catch (caught) {
      if (!controller.signal.aborted) setError(errorText(caught));
    } finally {
      if (!controller.signal.aborted) setAttaching(false);
    }
  }
  async function chooseFile(next: File | null) {
    inspectController.current?.abort();
    setFile(next);
    setTable('');
    setTables([]);
    setError('');
    setNotice('');
    setInspecting(false);
    if (!next) return;
    if (next.size > 2 * 1024 * 1024) {
      setError('Choose a file of at most 2 MiB.');
      setFile(null);
      return;
    }
    if (/\.(xlsx|sqlite|sqlite3|db)$/i.test(next.name)) {
      const controller = new AbortController();
      inspectController.current = controller;
      setInspecting(true);
      try {
        const info = await hospitalService.inspect(next, controller.signal);
        if (!controller.signal.aborted) {
          setTables(info.tables);
          if (info.tables.length === 1) setTable(info.tables[0]);
        }
      } catch (caught) {
        if (!controller.signal.aborted) setError(errorText(caught));
      } finally {
        if (!controller.signal.aborted) setInspecting(false);
      }
    }
  }
  async function importRecords() {
    if (!file) return;
    const controller = new AbortController();
    importController.current = controller;
    setImporting(true);
    setError('');
    setNotice('');
    try {
      const accepted = await hospitalService.import(
        file,
        table || undefined,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setNotice(
        `${accepted.imported} encounters imported · ${accepted.unchanged} unchanged${accepted.duplicate ? ' · file already imported' : ''}`,
      );
      setRefresh((value) => value + 1);
    } catch (caught) {
      if (!controller.signal.aborted) setError(errorText(caught));
    } finally {
      if (!controller.signal.aborted) setImporting(false);
    }
  }
  async function queryRecords(event: { preventDefault(): void }) {
    event.preventDefault();
    if (!selected || !question.trim()) return;
    queryController.current?.abort();
    const controller = new AbortController();
    queryController.current = controller;
    setQuerying(true);
    setError('');
    setResult(null);
    try {
      const next = await hospitalService.query(
        selected,
        question.trim(),
        controller.signal,
      );
      if (!controller.signal.aborted) setResult(next);
    } catch (caught) {
      if (!controller.signal.aborted) setError(errorText(caught));
    } finally {
      if (!controller.signal.aborted) setQuerying(false);
    }
  }

  const graphNode = detail?.graph.nodes.find((node) => node.id === activeGraph);
  const graphEncounters =
    detail?.graph.nodes.filter(
      (node) => node.kind === 'encounter' || node.kind === 'source_document',
    ) ?? [];
  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-4 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-teal-700">
            <HeartPulse className="size-4" /> Hospital records
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            A clear view of the patient record.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Bring encounters together, follow the documented timeline, and trace
            every result to its source. Records stay in your local healthcare
            workspace.
          </p>
        </div>
        <Link
          href="/hospital/assessment"
          className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-2 text-xs"
        >
          Educational assessment <ArrowRight className="size-3" />
        </Link>
        <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-2 text-xs">
          <span className="size-2 rounded-full bg-teal-500" />
          Local record evidence
        </span>
      </header>
      <section
        className="grid gap-3 md:grid-cols-3"
        aria-label="Workspace scope"
      >
        {[
          {
            title: 'Patients',
            value: loading ? '…' : String(total),
            note: 'Stable IDs keep records separate',
            icon: UserRound,
          },
          {
            title: 'Recorded evidence',
            value: detail ? String(detail.evidence_count) : 'Select a patient',
            note: 'Observations, assessments and documented plans',
            icon: FileText,
          },
          {
            title: 'Educational assessment',
            value: 'Separate model tool',
            note: 'Research estimates; no clinical validation',
            icon: Activity,
          },
        ].map(({ title, value, note, icon: Icon }) => (
          <div key={title} className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              {title}
              <Icon className="size-4 text-teal-600" />
            </div>
            <p className="mt-3 text-xl font-semibold">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{note}</p>
          </div>
        ))}
      </section>
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
        >
          {error}
        </div>
      ) : null}
      {notice ? (
        <div
          aria-live="polite"
          className="flex gap-2 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900"
        >
          <Check className="size-4" />
          {notice}
        </div>
      ) : null}
      <div className="grid items-start gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="border-b p-4">
              <h2 className="font-semibold">Patient directory</h2>
              <label
                htmlFor="patient-search"
                className="mt-3 block text-xs text-muted-foreground"
              >
                Search ID or label
              </label>
              <Input
                id="patient-search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setOffset(0);
                }}
                placeholder="Patient ID or label"
                className="mt-1"
              />
            </div>
            <div className="max-h-[440px] overflow-auto p-2">
              {patients.map((patient) => (
                <button
                  key={patient.patient_id}
                  type="button"
                  onClick={() => selectPatient(patient.patient_id)}
                  aria-pressed={selected === patient.patient_id}
                  className={`mb-1 flex w-full items-center gap-3 rounded-lg border p-3 text-left ${selected === patient.patient_id ? 'border-teal-300 bg-teal-50' : 'border-transparent hover:bg-muted'}`}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                    <UserRound className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {patient.patient_label || patient.patient_id}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {patient.patient_id} · {patient.encounters} encounters
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
              {!loading && patients.length === 0 ? (
                <p className="p-4 text-sm leading-6 text-muted-foreground">
                  {search
                    ? 'No patients match this search.'
                    : 'Import records to create your patient directory.'}
                </p>
              ) : null}
              {loading ? (
                <p
                  aria-live="polite"
                  className="p-4 text-sm text-muted-foreground"
                >
                  Loading patients…
                </p>
              ) : null}
            </div>
            {total > 50 ? (
              <div className="flex items-center justify-between border-t p-3">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={offset === 0}
                  onClick={() => setOffset((value) => value - 50)}
                >
                  Previous
                </Button>
                <span className="text-xs">
                  {offset + 1}–{Math.min(offset + 50, total)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={offset + 50 >= total}
                  onClick={() => setOffset((value) => value + 50)}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </section>
          <section className="rounded-xl border bg-card p-4">
            <h2 className="font-semibold">Register a patient</h2>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Create an administrative record, then attach documents to that
              patient. No clinical values are fabricated.
            </p>
            <form
              onSubmit={(event) => void createPatient(event)}
              className="mt-3 space-y-3"
            >
              <div>
                <label htmlFor="new-patient-id" className="text-xs font-medium">
                  Stable patient ID
                </label>
                <Input
                  id="new-patient-id"
                  maxLength={100}
                  pattern={'[A-Za-z0-9][A-Za-z0-9_.:\\x2D]*'}
                  required
                  value={newPatientId}
                  onChange={(event) => setNewPatientId(event.target.value)}
                  placeholder="e.g. PAT-001"
                  disabled={!canEdit || creatingPatient}
                />
              </div>
              <div>
                <label
                  htmlFor="new-patient-label"
                  className="text-xs font-medium"
                >
                  Display label (optional)
                </label>
                <Input
                  id="new-patient-label"
                  maxLength={160}
                  value={newPatientLabel}
                  onChange={(event) => setNewPatientLabel(event.target.value)}
                  disabled={!canEdit || creatingPatient}
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                className="w-full"
                disabled={!canEdit || creatingPatient || !newPatientId.trim()}
              >
                {creatingPatient ? 'Registering…' : 'Register patient'}
              </Button>
            </form>
          </section>
          <section className="rounded-xl border bg-card p-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <Upload className="size-4 text-teal-700" />
              Import patient records
            </h2>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              CSV, JSON, XLSX or SQLite · up to 2 MiB and 1,000 encounters per
              import. Use one row per encounter with explicit patient and
              encounter IDs.
            </p>
            <label
              htmlFor="hospital-file"
              className="mt-4 block text-xs font-medium"
            >
              Choose record file
            </label>
            <input
              id="hospital-file"
              type="file"
              accept=".csv,.json,.xlsx,.sqlite,.sqlite3,.db"
              disabled={!canEdit || importing}
              onChange={(event) =>
                void chooseFile(event.target.files?.[0] ?? null)
              }
              className="mt-2 block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2"
            />
            {inspecting ? (
              <p aria-live="polite" className="mt-2 text-xs">
                Inspecting tables…
              </p>
            ) : null}
            {tables.length ? (
              <>
                <label
                  htmlFor="hospital-table"
                  className="mt-3 block text-xs font-medium"
                >
                  Worksheet / table
                </label>
                <select
                  id="hospital-table"
                  value={table}
                  onChange={(event) => setTable(event.target.value)}
                  className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
                >
                  <option value="">Select a table</option>
                  {tables.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            <Button
              className="mt-4 w-full"
              disabled={
                !canEdit ||
                !file ||
                importing ||
                inspecting ||
                (tables.length > 0 && !table)
              }
              onClick={() => void importRecords()}
            >
              {importing ? (
                <LoaderCircle className="mr-2 size-4 animate-spin" />
              ) : (
                <Database className="mr-2 size-4" />
              )}
              {importing ? 'Importing records…' : 'Validate & import'}
            </Button>
            {!canEdit ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Importing requires editor access.
              </p>
            ) : null}
            <div className="mt-4 border-t pt-3">
              <p className="text-xs font-medium">
                Download a synthetic template
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {['csv', 'json', 'xlsx', 'sqlite'].map((format) => (
                  <a
                    key={format}
                    href={hospitalService.templateUrl(format)}
                    download
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] hover:bg-muted"
                  >
                    <Download className="size-3" />
                    {format.toUpperCase()}
                  </a>
                ))}
              </div>
            </div>
            <details className="mt-4 text-xs leading-5">
              <summary className="cursor-pointer font-medium">
                Expected fields and import rules
              </summary>
              <p className="mt-2 text-muted-foreground">
                Required: patient_id, encounter_id, recorded_at (ISO date).
                Optional: patient_label, observations, conditions, care_plan,
                prognosis_note, notes. Observations and conditions are JSON
                arrays in tabular files. Observations use name, value, unit;
                conditions use name and status: confirmed, suspected, negated or
                historical. Additional fields are retained. Conflicting
                encounter IDs reject the whole file. Formulas, views and
                triggers are unsupported. Limits: 5,000 encounters total; 500
                per patient; 32 MiB stored record data; 128 KiB per normalized +
                original record.
              </p>
            </details>
          </section>
        </aside>
        <main className="min-w-0 space-y-5">
          {!selected ? (
            <section className="grid min-h-[500px] place-items-center rounded-xl border border-dashed bg-card p-8 text-center">
              <div>
                <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-teal-50 text-teal-700">
                  <HeartPulse className="size-8" />
                </span>
                <h2 className="mt-5 text-xl font-semibold">
                  Start with a patient, follow the evidence.
                </h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                  Import a template-compatible file, then select a patient to
                  explore recorded observations, condition statuses, source
                  documents and encounter history.
                </p>
                <p className="mt-5 text-xs text-muted-foreground">
                  Patient identity comes from patient_id, never a name match.
                </p>
              </div>
            </section>
          ) : !detail ? (
            <div aria-live="polite" className="rounded-xl border bg-card p-8">
              Loading patient record…
            </div>
          ) : (
            <>
              <section className="rounded-xl border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-teal-700">
                      PATIENT RECORD
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold">
                      {detail.patient_label || detail.patient_id}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {detail.patient_id} · {detail.total_encounters} documented
                      encounters
                    </p>
                  </div>
                  <span className="rounded-full border bg-muted px-3 py-1 text-xs">
                    Source-recorded information
                  </span>
                </div>
                <p className="mt-4 rounded-lg bg-muted p-3 text-xs leading-5 text-muted-foreground">
                  Condition status, care plans and prognosis notes below
                  reproduce imported documentation. They are not automated
                  diagnoses, predictions or new clinical recommendations. The
                  separate educational assessment tool uses research datasets
                  and has no clinical validation.
                </p>
              </section>
              <section className="rounded-xl border bg-card p-5">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Upload className="size-4 text-teal-700" />
                  Patient documents
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Explicitly attach a PDF, TXT, Markdown or DOCX to{' '}
                  {detail.patient_id}. Patient names are never inferred. Text
                  extraction adds cited evidence without inferring a diagnosis.
                  Text PDFs only; scanned documents need OCR.
                </p>
                <label
                  htmlFor="patient-document"
                  className="mt-4 block text-xs font-medium"
                >
                  Document for {detail.patient_id} · up to 10 MiB
                </label>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <input
                    id="patient-document"
                    type="file"
                    accept=".pdf,.txt,.md,.docx"
                    disabled={!canEdit || attaching}
                    onChange={(event) =>
                      setDocumentFile(event.target.files?.[0] ?? null)
                    }
                    className="min-w-0 flex-1 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2"
                  />
                  <Button
                    size="sm"
                    disabled={!canEdit || attaching || !documentFile}
                    onClick={() => void attachDocument()}
                  >
                    {attaching ? 'Attaching…' : 'Attach to this patient'}
                  </Button>
                </div>
                <div className="mt-4 space-y-2">
                  {documents.map((document) => (
                    <div
                      key={document.document_id}
                      className="rounded-lg border p-3"
                    >
                      <div className="flex flex-wrap justify-between gap-2 text-xs">
                        <span className="font-medium">{document.name}</span>
                        <span>
                          {document.status} · {document.progress}%
                          {document.status === 'completed'
                            ? ` · ${document.chunks} chunks`
                            : ''}
                        </span>
                      </div>
                      {document.error ? (
                        <p className="mt-2 text-xs text-rose-700">
                          {document.error}
                        </p>
                      ) : null}
                      {document.status === 'failed' && canEdit ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          disabled={attaching}
                          onClick={() => void retryDocument(document.job_id)}
                        >
                          Retry parsing
                        </Button>
                      ) : null}
                      {document.warnings.map((warning, index) => (
                        <p
                          key={index}
                          className="mt-1 text-[11px] text-muted-foreground"
                        >
                          {warning}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
                {documents.some(
                  (document) => document.status === 'completed',
                ) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      setRefresh((value) => value + 1);
                      setResult(null);
                    }}
                  >
                    Refresh document graph
                  </Button>
                ) : null}
              </section>
              <section className="rounded-xl border bg-card p-5">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Search className="size-4 text-teal-700" />
                  Search this patient’s evidence
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Lexical search · restricted to {detail.patient_id} before
                  ranking · recorded fields and completed attached sources
                </p>
                <form
                  onSubmit={(event) => void queryRecords(event)}
                  className="mt-4 flex gap-2"
                >
                  <label htmlFor="hospital-question" className="sr-only">
                    Question or search terms for selected patient
                  </label>
                  <Input
                    id="hospital-question"
                    maxLength={500}
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="Search a recorded measurement, assessment or plan…"
                  />
                  <Button
                    type="submit"
                    disabled={querying || !question.trim()}
                    aria-label="Search patient evidence"
                  >
                    {querying ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <ArrowRight className="size-4" />
                    )}
                  </Button>
                </form>
                {result ? (
                  <div className="mt-4 space-y-3" aria-live="polite">
                    <p className="text-xs leading-5 text-muted-foreground">
                      {result.message}
                    </p>
                    {result.evidence.map((item) => (
                      <article
                        key={item.evidence_id}
                        className="rounded-lg border border-teal-100 bg-teal-50/40 p-3"
                      >
                        <div className="flex flex-wrap justify-between gap-2 text-[11px] font-medium text-teal-800">
                          <span>
                            {item.encounter_id} · {dateLabel(item.recorded_at)}{' '}
                            · {item.kind.replaceAll('_', ' ')}
                          </span>
                          <span>Matched: {item.matched_terms.join(', ')}</span>
                        </div>
                        <blockquote className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                          {item.text}
                        </blockquote>
                        <p className="mt-2 break-words text-[11px] text-muted-foreground">
                          {recordCitation(item.source, item.field)}
                          {item.truncated
                            ? ' · excerpt limited to 4,000 characters'
                            : ''}
                        </p>
                      </article>
                    ))}
                  </div>
                ) : null}
              </section>
              <section className="rounded-xl border bg-card p-5">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Network className="size-4 text-teal-700" />
                  Record evidence graph
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Patient → encounter / explicitly attached source → documented
                  field / chunk. Showing {detail.graph.shown_encounters} most
                  recent encounters and up to 15 fields each; document graphs
                  show the first two completed chunks per source. Every link is
                  structural.
                </p>
                <div className="mt-4 max-h-80 space-y-3 overflow-auto rounded-lg bg-muted/40 p-3">
                  <div className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-900">
                    <UserRound className="size-4" />
                    {detail.patient_id}
                  </div>
                  {graphEncounters.map((encounter) => (
                    <div
                      key={encounter.id}
                      className="ml-4 border-l-2 border-teal-200 pl-4"
                    >
                      <p className="flex items-center gap-2 text-xs font-medium">
                        <ChevronRight className="size-3" />
                        {encounter.label}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {detail.graph.edges
                          .filter((edge) => edge.source === encounter.id)
                          .map((edge) => {
                            const node = detail.graph.nodes.find(
                              (item) => item.id === edge.target,
                            );
                            return node ? (
                              <button
                                key={node.id}
                                type="button"
                                onClick={() => setActiveGraph(node.id)}
                                className={`max-w-52 truncate rounded-md border px-2 py-1 text-left text-[11px] ${activeGraph === node.id ? 'border-teal-400 bg-teal-50' : 'bg-card hover:border-teal-300'}`}
                                title={node.label}
                              >
                                {node.kind.replaceAll('_', ' ')}: {node.label}
                              </button>
                            ) : null;
                          })}
                      </div>
                    </div>
                  ))}
                </div>
                {graphNode ? (
                  <p className="mt-3 break-words rounded-lg border p-3 text-xs leading-5">
                    <strong>{graphNode.kind.replaceAll('_', ' ')}:</strong>{' '}
                    {graphNode.label}
                    <span className="mt-1 block text-muted-foreground">
                      Evidence ID: {graphNode.evidence_id}
                    </span>
                  </p>
                ) : null}
              </section>
              <section className="rounded-xl border bg-card p-5">
                <h2 className="font-semibold">Encounter timeline</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Newest record first. Statuses are kept exactly as documented.
                </p>
                {detail.total_encounters > 50 ? (
                  <div className="mt-3 flex items-center gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={encounterOffset === 0}
                      onClick={() => {
                        setDetail(null);
                        setEncounterOffset((value) => value - 50);
                      }}
                    >
                      Newer
                    </Button>
                    <span className="text-xs">
                      {encounterOffset + 1}–
                      {Math.min(encounterOffset + 50, detail.total_encounters)}{' '}
                      of {detail.total_encounters}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={encounterOffset + 50 >= detail.total_encounters}
                      onClick={() => {
                        setDetail(null);
                        setEncounterOffset((value) => value + 50);
                      }}
                    >
                      Older
                    </Button>
                  </div>
                ) : null}
                <div className="mt-5 space-y-5">
                  {detail.encounters.map((encounter) => (
                    <article
                      key={encounter.encounter_id}
                      className="relative rounded-xl border p-4"
                    >
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-medium">
                          {encounter.encounter_id}
                        </h3>
                        <time
                          dateTime={encounter.recorded_at}
                          className="rounded-full bg-muted px-3 py-1 text-xs"
                        >
                          {encounter.recorded_at.replace('T', ' ')}
                        </time>
                      </div>
                      {encounter.conditions.length ? (
                        <div className="mb-4 flex flex-wrap gap-2">
                          {encounter.conditions.map((condition, index) => (
                            <div
                              key={`${condition.name}-${index}`}
                              className={`rounded-lg border px-3 py-2 text-xs ${statusStyle[condition.status]}`}
                            >
                              <span className="font-semibold">
                                {condition.name}
                              </span>
                              <span className="ml-2 uppercase tracking-wide text-[10px]">
                                {condition.status}
                              </span>
                              {condition.detail ? (
                                <p className="mt-1 max-w-lg whitespace-pre-wrap">
                                  {condition.detail}
                                </p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mb-3 text-xs text-muted-foreground">
                          No condition assessment recorded.
                        </p>
                      )}
                      {encounter.observations.length ? (
                        <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {encounter.observations.map((observation, index) => (
                            <div
                              key={`${observation.name}-${index}`}
                              className="rounded-lg bg-muted/50 p-3"
                            >
                              <p className="text-xs text-muted-foreground">
                                {observation.name}
                              </p>
                              <p className="mt-1 break-words text-sm font-medium">
                                {observation.value}{' '}
                                <span className="text-xs font-normal text-muted-foreground">
                                  {observation.unit}
                                </span>
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {[
                        {
                          title: 'Documented care plan',
                          text: encounter.care_plan,
                        },
                        {
                          title: 'Source-recorded prognosis note',
                          text: encounter.prognosis_note,
                        },
                        { title: 'Notes', text: encounter.notes },
                      ]
                        .filter((item) => item.text)
                        .map((item) => (
                          <div key={item.title} className="mb-3">
                            <h4 className="text-xs font-semibold">
                              {item.title}
                            </h4>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                              {item.text}
                            </p>
                          </div>
                        ))}
                      <p className="break-words border-t pt-3 text-[11px] text-muted-foreground">
                        {recordCitation(encounter.source)}
                      </p>
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs text-teal-700">
                          Inspect original imported row / JSON object
                        </summary>
                        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted p-3 text-[11px]">
                          {JSON.stringify(encounter.raw_record, null, 2)}
                        </pre>
                      </details>
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
