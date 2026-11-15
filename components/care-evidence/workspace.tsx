'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/components/common/app-link';
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  FileText,
  Files,
  GitFork,
  LayoutDashboard,
  LoaderCircle,
  MessageSquareText,
  Network,
  Plus,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import { SessionControl, useSession } from '@/components/auth/session-provider';
import type { RetrievalResult } from '@/lib/types';
import type { StoredDocument } from '@/services/contracts';
import type { WorkspaceDocument } from '@/services/api/workspace-service';
import { HeroNetwork, SourceNetwork } from './network';
import {
  buildGraph,
  exampleQuestions,
  fileAccept,
  graphFromSource,
  ingestion,
  loadExtraction,
  loadSources,
  recognizedConcepts,
  retrieval,
  sampleName,
  samplePath,
  sourceLocation,
  uploadSource,
  type Extraction,
} from './source';
import './workspace.css';

const links = [
  { href: '#overview', name: 'Overview', icon: LayoutDashboard },
  { href: '#knowledge-graph', name: 'Knowledge graph', icon: Network },
  { href: '#sources', name: 'Sources', icon: Files },
  { href: '#ask-evidence', name: 'Ask evidence', icon: MessageSquareText },
];

const graphTabs = ['Graph', 'Relationships', 'Needs review'] as const;
type GraphTab = (typeof graphTabs)[number];

const reader = (id: string, offset = 0) => ingestion.getDocument!(id, offset);
const date = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeZone: 'Asia/Kolkata',
});
const percent = (value: number) => `${Math.round(value * 100)}%`;

interface SourceView {
  extraction: Extraction;
  document: StoredDocument;
}

async function readSource(
  id: string,
  signal: AbortSignal,
): Promise<SourceView> {
  const [extraction, document] = await Promise.all([
    loadExtraction(id, signal),
    reader(id),
  ]);
  return { extraction, document };
}

export function CareEvidence() {
  const { session } = useSession();
  const canEdit = session?.local_mode || session?.actor?.role === 'editor';
  const canOpen =
    session?.local_mode || session?.actor?.workspaces.includes('healthcare');
  const [sources, setSources] = useState<WorkspaceDocument[]>([]);
  const [view, setView] = useState<SourceView | null>(null);
  const [selected, setSelected] = useState('');
  const [tab, setTab] = useState<GraphTab>('Graph');
  const [section, setSection] = useState('#overview');
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<RetrievalResult | null>(null);
  const [mode, setMode] = useState<'hybrid' | 'lexical' | 'graph' | 'fuzzy'>(
    'hybrid',
  );
  const [dragging, setDragging] = useState(false);
  const [showPassages, setShowPassages] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const operation = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const graph = useMemo(
    () => graphFromSource(view?.extraction ?? null),
    [view],
  );
  const active = view?.document.documentId;
  const activeName = view?.document.name;
  const ready = Boolean(view?.extraction.configuration);
  const node = graph.concepts.find((concept) => concept.entity_id === selected);
  const names = useMemo(
    () =>
      new Map(
        graph.concepts.map((item) => [item.entity_id, item.canonical_name]),
      ),
    [graph],
  );

  useEffect(() => {
    if (!canOpen) return;
    const controller = new AbortController();
    async function initialize() {
      try {
        const list = await loadSources(controller.signal);
        if (controller.signal.aborted) return;
        setSources(list);
        if (list[0]) {
          const stored = await readSource(
            list[0].document_id,
            controller.signal,
          );
          if (!controller.signal.aborted) setView(stored);
        }
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : 'The source library could not be loaded.',
          );
      } finally {
        if (!controller.signal.aborted) setInitializing(false);
      }
    }
    void initialize();
    return () => {
      controller.abort();
      operation.current?.abort();
    };
  }, [canOpen]);

  async function run(
    label: string,
    task: (signal: AbortSignal) => Promise<void>,
  ) {
    if (initializing || operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(label);
    setError('');
    setFeedback('');
    try {
      await task(controller.signal);
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : 'The operation could not be completed.',
        );
    } finally {
      operation.current = null;
      if (!controller.signal.aborted) setBusy('');
    }
  }

  function selectSource(data: SourceView) {
    setView(data);
    setSelected('');
    setTab('Graph');
    setResult(null);
    setShowPassages(false);
  }

  function upload(file?: File) {
    void run(
      file ? 'Uploading source…' : 'Loading demo file…',
      async (signal) => {
        if (!canEdit) return;
        let source = file;
        if (!source) {
          const response = await fetch(samplePath, { signal });
          if (!response.ok)
            throw new Error('The demo file could not be loaded. Try again.');
          source = new File([await response.blob()], sampleName, {
            type: 'text/plain',
          });
        }
        const uploaded = await uploadSource(source, signal, (value) =>
          setBusy(
            value < 100
              ? `Processing source · ${value}%`
              : 'Building knowledge graph…',
          ),
        );
        const id = uploaded.document.documentId;
        setBusy('Building knowledge graph…');
        await completeGraph(id, signal, uploaded.warnings);
      },
    );
  }

  async function completeGraph(
    id: string,
    signal: AbortSignal,
    warnings: string[] = [],
  ) {
    // The source is durable before graph construction. Preserve it in the UI if building fails.
    try {
      const built = await buildGraph(id, signal);
      warnings = [...warnings, ...built.warnings];
    } finally {
      if (!signal.aborted) {
        const [list, data] = await Promise.all([
          loadSources(signal),
          readSource(id, signal),
        ]);
        if (!signal.aborted) {
          setSources(list);
          selectSource(data);
        }
      }
    }
    if (!signal.aborted)
      setFeedback(
        [
          'Source indexed. Open a concept or ask about the file.',
          ...warnings,
        ].join(' '),
      );
  }

  function ask(text: string) {
    const question = text.trim();
    if (!question || !active) return;
    void run('Finding source evidence…', async (signal) => {
      setQuery(question);
      setResult(null);
      const response = await retrieval.retrieve({
        query: question,
        documentId: active,
        mode,
        topK: 4,
        maxHops: 3,
        rankingProfile: 'domain',
        signal,
      });
      if (!signal.aborted) setResult(response);
    });
  }

  function loadMore() {
    if (!view || view.document.nextOffset === null) return;
    const current = view.document;
    void run('Loading passages…', async (signal) => {
      const next = await reader(current.documentId, current.nextOffset ?? 0);
      if (!signal.aborted)
        setView({
          ...view,
          document: { ...next, chunks: [...current.chunks, ...next.chunks] },
        });
    });
  }

  const blocked = Boolean(busy) || initializing;

  if (!canOpen) {
    return (
      <main className="care-access">
        <ShieldCheck />
        <h1>Care Evidence access required</h1>
        <p>Open an assigned workspace with this account.</p>
        <Link href="/workspaces">
          <ArrowLeft size={16} /> View workspaces
        </Link>
        <SessionControl />
      </main>
    );
  }

  return (
    <div className="care-app">
      <aside className="care-sidebar">
        <a
          href="#overview"
          className="care-brand"
          onClick={() => setSection('#overview')}
        >
          <span className="care-mark">
            <GitFork size={20} strokeWidth={2.3} />
          </span>
          <span>
            <strong>Care Evidence</strong>
            <small>BY SOFTGRAPH</small>
          </span>
        </a>
        <nav aria-label="Care Evidence workspace">
          <p>WORKSPACE</p>
          {links.map(({ href, name, icon: Icon }) => (
            <a
              href={href}
              key={href}
              aria-current={section === href ? 'location' : undefined}
              onClick={() => setSection(href)}
            >
              <Icon size={17} />
              <span>{name}</span>
            </a>
          ))}
        </nav>
        <div className="care-side-footer">
          <a href="#method" onClick={() => setSection('#method')}>
            <CircleHelp size={16} /> How it works <ArrowUpRight size={13} />
          </a>
          <Link href="/laboratory">
            <BookOpen size={16} /> Learning lab <ArrowUpRight size={13} />
          </Link>
          <div className="care-workspace-id">
            <span className="care-avatar">CE</span>
            <span>
              <strong>Hospital operations</strong>
              <small>Procedure intelligence</small>
            </span>
          </div>
        </div>
      </aside>

      <div className="care-main">
        <header className="care-topbar">
          <div className="care-breadcrumb">
            <LayoutDashboard size={16} />
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>
              {links.find((link) => link.href === section)?.name ??
                'How it works'}
            </strong>
          </div>
          <div className="care-top-actions">
            {session?.local_mode ? (
              <span className="care-local">
                <span /> Local workspace
              </span>
            ) : (
              <SessionControl />
            )}
            <button
              className="care-button care-top-upload"
              type="button"
              disabled={!canEdit || blocked}
              onClick={() => input.current?.click()}
            >
              <Plus size={17} /> Upload source
            </button>
          </div>
        </header>
        <main className="care-content" id="overview">
          <input
            ref={input}
            type="file"
            aria-label="Choose source file"
            accept={fileAccept}
            hidden
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (file) upload(file);
            }}
          />
          <section className="care-hero" aria-labelledby="care-title">
            <div className="care-hero-copy">
              <div className="care-kicker">
                <Activity size={15} /> HOSPITAL OPERATIONS
              </div>
              <h1 id="care-title">
                Make every handoff <em>traceable.</em>
              </h1>
              <p>
                Turn procedure documents into a living knowledge graph. See how
                workflows connect and trace every answer to its source.
              </p>
              <div className="care-hero-actions">
                <button
                  type="button"
                  className="care-button care-primary"
                  disabled={!canEdit || blocked}
                  onClick={() => upload()}
                >
                  <FileText size={17} /> Run demo file <ArrowRight size={16} />
                </button>
                <a
                  className="care-button care-secondary"
                  href={samplePath}
                  download
                >
                  <ArrowDownToLine size={16} /> Download example
                </a>
              </div>
            </div>
            <HeroNetwork />
          </section>

          <div className="care-live" aria-live="polite">
            {busy && (
              <p>
                <LoaderCircle size={17} className="care-spin" /> {busy}
              </p>
            )}
            {feedback && !busy && (
              <p>
                <Check size={17} /> {feedback}
              </p>
            )}
          </div>
          {error && (
            <p className="care-error" role="alert">
              {error}
            </p>
          )}

          <section className="care-stats" aria-label="Source and graph metrics">
            {[
              {
                icon: Files,
                label: 'Indexed sources',
                value: initializing ? '—' : sources.length,
                sub: 'Procedure library',
                tone: 'mint',
              },
              {
                icon: Network,
                label: 'Concepts',
                value: active ? graph.concepts.length : '—',
                sub: 'Recognized in active source',
                tone: 'blue',
              },
              {
                icon: GitFork,
                label: 'Relationships',
                value: active ? graph.edges.length : '—',
                sub: 'Supported by source text',
                tone: 'lilac',
              },
              {
                icon: CircleHelp,
                label: 'Needs review',
                value: active ? graph.review.length : '—',
                sub: 'Uncertain or weak statements',
                tone: 'sand',
              },
            ].map(({ icon: Icon, label, value, sub, tone }) => (
              <div className="care-stat" key={label}>
                <span className={`care-stat-icon ${tone}`}>
                  <Icon size={18} />
                </span>
                <div>
                  <h2>{label}</h2>
                  <strong>{value}</strong>
                  <p>{sub}</p>
                </div>
              </div>
            ))}
          </section>

          <div className="care-workbench">
            <section
              id="knowledge-graph"
              className="care-card care-graph-card"
              aria-labelledby="graph-heading"
            >
              <div className="care-card-heading">
                <div>
                  <h2 id="graph-heading">Knowledge graph</h2>
                  <p>{activeName ?? 'A map of your documented workflows'}</p>
                </div>
                <span className="care-badge">
                  <span />
                  {ready
                    ? 'Source graph'
                    : active
                      ? 'Build pending'
                      : 'Awaiting source'}
                </span>
              </div>
              <div className="care-tabs" aria-label="Graph views">
                {graphTabs.map((item) => (
                  <button
                    type="button"
                    key={item}
                    aria-pressed={tab === item}
                    onClick={() => setTab(item)}
                  >
                    {item}
                    {item === 'Needs review' && graph.review.length > 0 && (
                      <span>{graph.review.length}</span>
                    )}
                  </button>
                ))}
              </div>
              {tab === 'Graph' && graph.concepts.length > 0 ? (
                <SourceNetwork
                  key={active}
                  concepts={graph.concepts}
                  edges={graph.edges}
                  selected={selected}
                  onSelect={(id) => setSelected(id === selected ? '' : id)}
                />
              ) : tab === 'Graph' ? (
                <div className="care-empty-network">
                  <div className="care-empty-icon">
                    <Network size={25} />
                  </div>
                  <h3>
                    {initializing
                      ? 'Loading your workspace…'
                      : ready
                        ? 'No recognized concepts'
                        : active
                          ? 'Source ready to build'
                          : 'Your graph starts with a source'}
                  </h3>
                  <p>
                    {ready
                      ? 'Search the passage text or check the supported vocabulary below.'
                      : active
                        ? 'The source is saved. Build its graph to inspect relationships.'
                        : 'Run the example above or upload a procedure document to see its concepts and relationships.'}
                  </p>
                  {active && !ready && (
                    <button
                      className="care-button care-outline"
                      disabled={!canEdit || blocked}
                      onClick={() =>
                        void run('Building knowledge graph…', (signal) =>
                          completeGraph(active, signal),
                        )
                      }
                    >
                      Build graph
                    </button>
                  )}
                  {!active && !initializing && (
                    <button
                      className="care-button care-outline"
                      disabled={!canEdit || blocked}
                      onClick={() => input.current?.click()}
                    >
                      <UploadCloud size={15} /> Choose a file
                    </button>
                  )}
                </div>
              ) : (
                <div className="care-candidates">
                  {(tab === 'Relationships' ? graph.edges : graph.review).map(
                    (candidate) => (
                      <article key={candidate.candidate_id}>
                        <div>
                          <strong>
                            {candidate.relation_type.replaceAll('_', ' ')}
                          </strong>
                          <span className="care-tag">
                            {percent(candidate.extraction_confidence)} heuristic
                          </span>
                        </div>
                        <blockquote>“{candidate.evidence}”</blockquote>
                        <p>
                          {tab === 'Needs review'
                            ? candidate.reason
                            : `${names.get(candidate.source_entity)} → ${names.get(candidate.target_entity)}`}
                        </p>
                      </article>
                    ),
                  )}
                  {(tab === 'Relationships' ? graph.edges : graph.review)
                    .length === 0 && (
                    <p className="care-empty-list">
                      {ready
                        ? `No ${tab === 'Relationships' ? 'accepted relationships' : 'candidates awaiting review'} in this source.`
                        : 'Build the graph to see relationship evidence.'}
                    </p>
                  )}
                </div>
              )}
              {tab === 'Graph' && node ? (
                <div className="care-inspector">
                  <div>
                    <h3>{node.canonical_name}</h3>
                    <span className="care-tag">
                      {percent(node.extraction_confidence)} heuristic
                    </span>
                  </div>
                  <p>
                    {activeName} · {sourceLocation(node.source_location)}
                  </p>
                  {graph.edges
                    .filter((edge) =>
                      [edge.source_entity, edge.target_entity].includes(
                        node.entity_id,
                      ),
                    )
                    .map((edge) => (
                      <blockquote key={edge.candidate_id}>
                        “{edge.evidence}”
                      </blockquote>
                    ))}
                </div>
              ) : (
                <div className="care-graph-footer">
                  <span>
                    <i /> Concept
                  </span>
                  <span>
                    <i /> Supported relationship
                  </span>
                  <span>
                    {ready
                      ? view?.extraction.graph_version
                      : 'Source-backed connections'}
                  </span>
                </div>
              )}
            </section>

            <section
              id="ask-evidence"
              className="care-card care-ask"
              aria-labelledby="ask-heading"
            >
              <div className="care-card-heading">
                <div>
                  <h2 id="ask-heading">Ask evidence</h2>
                  <p>Search the active source</p>
                </div>
                <span className="care-stat-icon mint">
                  <MessageSquareText size={19} />
                </span>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  ask(query);
                }}
              >
                <label htmlFor="care-query">Your question</label>
                <textarea
                  id="care-query"
                  maxLength={2000}
                  rows={3}
                  placeholder="How does Care Handoff use Discharge Checklist?"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <div className="care-query-actions">
                  <label>
                    <span className="care-sr-only">Ranking mode</span>
                    <select
                      value={mode}
                      onChange={(event) =>
                        setMode(event.target.value as typeof mode)
                      }
                    >
                      <option value="hybrid">Hybrid ranking</option>
                      <option value="lexical">Text ranking</option>
                      <option value="graph">Graph ranking</option>
                      <option value="fuzzy">Fuzzy ranking</option>
                    </select>
                  </label>
                  <button
                    className="care-button"
                    disabled={blocked || !ready || !query.trim()}
                  >
                    Search <ArrowRight size={15} />
                  </button>
                </div>
              </form>
              <div className="care-suggestions">
                <h3>Try a question</h3>
                {exampleQuestions.map((question) => (
                  <button
                    type="button"
                    key={question}
                    disabled={blocked || !ready}
                    onClick={() => ask(question)}
                  >
                    {question}
                    <ArrowUpRight size={13} />
                  </button>
                ))}
              </div>
              {result && <SearchResult result={result} />}
            </section>
          </div>

          <section
            id="sources"
            className="care-card care-sources"
            aria-labelledby="sources-heading"
          >
            <div className="care-card-heading">
              <div>
                <h2 id="sources-heading">Sources</h2>
                <p>Select the procedure you want to inspect or search.</p>
              </div>
              <button
                className="care-button care-outline"
                disabled={!canEdit || blocked}
                onClick={() => input.current?.click()}
              >
                <Plus size={16} /> Upload a file
              </button>
            </div>
            {canEdit && (
              <div
                className={`care-drop ${dragging ? 'is-dragging' : ''}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!blocked) setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  const file = event.dataTransfer.files[0];
                  if (!blocked && file) upload(file);
                }}
              >
                <span className="care-stat-icon mint">
                  <UploadCloud size={19} />
                </span>
                <div>
                  <strong>Drop a procedure file here</strong>
                  <p>
                    TXT, Markdown, text PDF, DOCX, CSV or JSON · up to 10 MiB
                  </p>
                </div>
              </div>
            )}
            {sources.length > 0 && (
              <ul className="care-source-list">
                {sources.map((source) => (
                  <li key={source.document_id}>
                    <button
                      type="button"
                      aria-pressed={active === source.document_id}
                      disabled={blocked}
                      onClick={() =>
                        void run('Opening source…', async (signal) => {
                          const data = await readSource(
                            source.document_id,
                            signal,
                          );
                          if (!signal.aborted) selectSource(data);
                        })
                      }
                    >
                      <FileText size={18} />
                      <span>
                        <strong>{source.name}</strong>
                        <small>
                          {/\.(md|markdown)$/i.test(source.name)
                            ? 'MD'
                            : source.source_type.toUpperCase()}{' '}
                          · {date.format(new Date(source.timestamp))}
                        </small>
                      </span>
                      {active === source.document_id ? (
                        <span className="care-tag">Active</span>
                      ) : (
                        <ChevronRight size={16} />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {view && (
              <div className="care-passages">
                <button
                  className="care-button care-outline"
                  type="button"
                  aria-expanded={showPassages}
                  onClick={() => setShowPassages(!showPassages)}
                >
                  {showPassages ? 'Hide' : 'Read'} source text (
                  {view.document.totalChunks}{' '}
                  {view.document.totalChunks === 1 ? 'passage' : 'passages'})
                </button>
                {canEdit && ready && active && (
                  <button
                    type="button"
                    className="care-button care-outline"
                    disabled={blocked}
                    onClick={() =>
                      void run('Rebuilding knowledge graph…', (signal) =>
                        completeGraph(active, signal),
                      )
                    }
                  >
                    Rebuild graph
                  </button>
                )}
                {showPassages && (
                  <>
                    {view.document.chunks.map((chunk) => (
                      <article key={chunk.chunkId}>
                        <h3>{sourceLocation(chunk.sourceLocation)}</h3>
                        <p>{chunk.text}</p>
                      </article>
                    ))}
                    {view.document.nextOffset !== null && (
                      <button
                        className="care-button care-outline"
                        disabled={blocked}
                        onClick={loadMore}
                      >
                        Load more passages
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
          <details id="method" className="care-card care-method">
            <summary>
              How it works <CircleHelp size={17} />
            </summary>
            <p>
              Care Evidence stores procedure passages and their locations. It
              learns new labels from explicit statements such as “The Equipment
              Register supports the Asset Audit.” Uncertain statements stay in
              Needs review. Files without supported relationships remain
              searchable.
            </p>
            <ul>
              {recognizedConcepts.map((term) => (
                <li className="care-tag" key={term}>
                  {term}
                </li>
              ))}
            </ul>
            <p>
              Designed for hospital operations procedures and synthetic demo
              data. Use the <Link href="/laboratory">Learning lab</Link> for GA,
              PSO, ACO and other course experiments.
            </p>
          </details>
        </main>
      </div>
    </div>
  );
}

function SearchResult({ result }: { result: RetrievalResult }) {
  const hasEvidence = result.answerStatus === 'evidence';
  return (
    <div className="care-answer" aria-live="polite">
      <p className="care-result-query">{result.query}</p>
      <h3>{hasEvidence ? 'Cited source excerpts' : 'Insufficient evidence'}</h3>
      {!hasEvidence && <p>{result.answer}</p>}
      {result.evidence.map((item, index) => (
        <details
          className="care-citation"
          key={item.chunkId}
          open={index === 0}
        >
          <summary>
            <span>[{item.citation}]</span> {item.source} ·{' '}
            {sourceLocation(item.sourceLocation)}
          </summary>
          <blockquote>“{item.excerpt ?? item.text}”</blockquote>
          {item.excerpt !== item.text && <p>{item.text}</p>}
        </details>
      ))}
      {result.paths.map((path) => (
        <details className="care-path-trace" key={path.labels.join('|')}>
          <summary className="care-path">
            <GitFork size={15} />
            <span>
              {path.labels.join(' → ')}
              {path.citationIds?.length
                ? ` [${path.citationIds.join(', ')}]`
                : ''}
            </span>
          </summary>
          <ol>
            {path.relationIds?.map((id) => {
              const relation = result.relations.find(
                (edge) => edge.relationId === id,
              );
              if (!relation) return null;
              const passage = result.evidence.find(
                (item) => item.chunkId === relation.sourceChunk,
              );
              const source = result.nodes.find(
                (item) => item.entityId === relation.sourceEntity,
              );
              const target = result.nodes.find(
                (item) => item.entityId === relation.targetEntity,
              );
              return (
                <li key={id}>
                  <strong>
                    {source?.canonicalName} ·{' '}
                    {relation.relationType.replaceAll('_', ' ')} →{' '}
                    {target?.canonicalName}
                  </strong>
                  <blockquote>“{relation.evidence}”</blockquote>
                  {passage && (
                    <p>
                      [{passage.citation}] {passage.source} ·{' '}
                      {sourceLocation(passage.sourceLocation)}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
          <p>
            Search can follow a link in either direction. Each step above shows
            the direction recorded in the source.
          </p>
        </details>
      ))}
      {result.paths.length === 0 && (
        <p className="care-path">No cited graph path for this query.</p>
      )}
      <details className="care-scoring">
        <summary>Why these results ranked here</summary>
        <p>
          Top passage ranking score {result.confidence.toFixed(3)}. Heuristic
          relevance on a 0–1 scale.
        </p>
        <dl>
          {result.scoreBreakdown.map((item) => (
            <div key={item.component}>
              <dt>{item.component}</dt>
              <dd>
                {item.rawScore.toFixed(3)} × {item.weight.toFixed(2)} ={' '}
                {item.contribution.toFixed(3)}
              </dd>
            </div>
          ))}
        </dl>
        <p>
          <strong>Mamdani rule firings</strong>
        </p>
        <ul>
          {result.fuzzyExplanation.ruleFirings
            .filter((rule) => rule.strength > 0)
            .map((rule) => (
              <li key={rule.ruleId}>
                {rule.rule} ({rule.strength.toFixed(3)})
              </li>
            ))}
        </ul>
        {result.warnings?.map((warning) => (
          <p key={warning}>{warning}</p>
        ))}
        <p>
          {result.graphVersion} · {result.configurationVersion}
        </p>
      </details>
    </div>
  );
}
