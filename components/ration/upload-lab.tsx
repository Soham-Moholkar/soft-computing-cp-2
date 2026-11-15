'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  FileText,
  FileUp,
  LoaderCircle,
  Network,
  Search,
} from 'lucide-react';
import { SourceNetwork } from '@/components/care-evidence/network';
import {
  graphFromSource,
  sourceLocation,
  type Candidate,
} from '@/components/care-evidence/source';
import {
  acceptFiles,
  askSource,
  build,
  listSources,
  readSource,
  upload,
} from '@/lib/ration/uploads';
import type { Language } from '@/lib/ration/guide';
import type { RetrievalResult } from '@/lib/types';
import type { WorkspaceDocument } from '@/services/api/workspace-service';
import { EvidenceGraph, type ProofEdge } from './evidence-graph';
import '@/components/care-evidence/workspace.css';

type Source = Awaited<ReturnType<typeof readSource>>;
const sample = '/demo/ration-guide.csv';
const large = '/demo/fictional-district-desk.csv';
const largeQuestion = 'How is Acacia Help Desk related to Acacia Visit Plan?';
const demoQuestion =
  'How is One Nation One Ration Card related to Monthly Entitlement?';

function proofEdges(result: RetrievalResult) {
  const accepted = new Map(
    result.relations.map((relation) => [relation.relationId, relation]),
  );
  const order = new Set([
    ...(result.paths[0]?.relationIds ?? []),
    ...accepted.keys(),
  ]);
  const names = new Map(
    result.nodes.map((node) => [node.entityId, node.canonicalName]),
  );
  const proof: ProofEdge[] = [];
  for (const key of order) {
    const edge = accepted.get(key);
    if (!edge) continue;
    const item = result.evidence.find(
      (source) => source.chunkId === edge.sourceChunk,
    );
    const from = names.get(edge.sourceEntity);
    const to = names.get(edge.targetEntity);
    if (item && from && to)
      proof.push({
        id: key,
        from,
        verb: edge.relationType,
        to,
        quote: edge.evidence,
        citation: `[${item.citation}] ${item.source} · ${sourceLocation(item.sourceLocation)}`,
      });
    if (proof.length === 5) break;
  }
  return proof;
}

function localNotes(documentId?: string): string[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem('ration-review-' + documentId) ?? '[]',
    );
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

export function UploadLab({ language }: { language: Language }) {
  const [sources, setSources] = useState<WorkspaceDocument[]>([]);
  const [active, setActive] = useState<Source | null>(null);
  const [tab, setTab] = useState<'graph' | 'review' | 'passages'>('graph');
  const [selectedNode, setSelectedNode] = useState('');
  const [job, setJob] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<RetrievalResult | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const running = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const graph = useMemo(
    () => graphFromSource(active?.extraction ?? null),
    [active],
  );
  const names = useMemo(
    () =>
      new Map(
        graph.concepts.map((node) => [node.entity_id, node.canonical_name]),
      ),
    [graph],
  );
  const selected = graph.concepts.find(
    (node) => node.entity_id === selectedNode,
  );
  const built = Boolean(active?.extraction.configuration);

  const select = useCallback((source: Source) => {
    setActive(source);
    setTab('graph');
    setSelectedNode('');
    setResult(null);
    setNotes(localNotes(source.document.documentId));
  }, []);

  useEffect(() => {
    let disposed = false;
    async function restore() {
      try {
        const data = await listSources();
        if (!disposed) setSources(data);
        if (data[0]) {
          const source = await readSource(data[0].document_id);
          if (!disposed) select(source);
        }
      } catch {
        if (!disposed)
          setError(
            'The upload service could not be reached. Start the local launcher, then reopen the Evidence lab. The public guide works separately.',
          );
      } finally {
        if (!disposed) setReady(true);
      }
    }
    void restore();
    return () => {
      disposed = true;
    };
  }, [select]);

  async function run(label: string, action: () => Promise<void>) {
    if (running.current || !ready) return;
    running.current = true;
    setJob(label);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The request failed. Try again.',
      );
    } finally {
      setJob('');
      running.current = false;
    }
  }
  async function buildSource(id: string, warnings: string[] = []) {
    setJob('Building graph from stored passages…');
    try {
      const response = await build(id);
      setNotice(['Graph ready.', ...warnings, ...response.warnings].join(' '));
    } finally {
      const [data, source] = await Promise.all([listSources(), readSource(id)]);
      setSources(data);
      select(source);
    }
  }
  function startUpload(file?: File, demo?: string) {
    void run('Reading source…', async () => {
      let source = file;
      if (demo) {
        const response = await fetch(demo);
        if (!response.ok)
          throw new Error('Could not load the demonstration file.');
        source = new File(
          [await response.blob()],
          demo.split('/').pop() ?? 'demo.csv',
          { type: 'text/csv' },
        );
      }
      if (!source) return;
      const uploaded = await upload(source, (value) =>
        setJob(
          value === 100
            ? 'Passages saved.'
            : `Reading and splitting source · ${value}%`,
        ),
      );
      await buildSource(uploaded.document.documentId, uploaded.warnings);
    });
  }
  function search(text: string) {
    const id = active?.document.documentId;
    if (!id || !text.trim() || !built) return;
    void run('Ranking passages and checking the path…', async () => {
      setQuery(text);
      setResult(null);
      setResult(await askSource(id, text.trim()));
    });
  }
  function mark(candidate: Candidate) {
    const id = active?.document.documentId;
    if (!id) return;
    const next = notes.includes(candidate.candidate_id)
      ? notes.filter((item) => item !== candidate.candidate_id)
      : [...notes, candidate.candidate_id];
    try {
      localStorage.setItem('ration-review-' + id, JSON.stringify(next));
    } catch {
      setError(
        'Browser storage is unavailable. The review mark could not be saved.',
      );
      return;
    }
    setNotes(next);
  }

  return (
    <div className="rs-lab" lang="en">
      <section className="rs-lab-heading">
        <div>
          <p className="rs-kicker">
            <Network size={16} /> Source workbench
          </p>
          <h1>Follow the evidence.</h1>
          <p>
            {language === 'hi'
              ? 'इस स्रोत जाँच में तकनीकी शब्द अंग्रेज़ी में हैं। ऊपर सहायता लें पर क्लिक करके हिन्दी गाइड पर लौटें।'
              : 'Upload public material. Inspect how the file becomes a graph and how a question selects its evidence.'}
          </p>
        </div>
        <div className="rs-lab-links">
          <a href={sample} className="rs-secondary" download>
            <ArrowDownToLine size={17} /> Download guide CSV
          </a>
          <a href={large} className="rs-secondary" download>
            <ArrowDownToLine size={17} /> Download 128-row fictional CSV
          </a>
        </div>
      </section>
      <section className="rs-upload-panel">
        <FileUp size={31} />
        <div>
          <h2>Upload a public document</h2>
          <p>TXT, Markdown, text PDF, DOCX, CSV or JSON · Up to 10 MiB</p>
        </div>
        <input
          ref={input}
          type="file"
          accept={acceptFiles}
          aria-label="Choose source file"
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) startUpload(file);
          }}
        />
        <button
          type="button"
          className="rs-secondary"
          disabled={!!job || !ready}
          onClick={() => startUpload(undefined, sample)}
        >
          Run guide demo
        </button>
        <button
          type="button"
          className="rs-secondary"
          disabled={!!job || !ready}
          onClick={() => startUpload(undefined, large)}
        >
          Run large fictional demo
        </button>
        <button
          type="button"
          className="rs-primary"
          disabled={!!job || !ready}
          onClick={() => input.current?.click()}
        >
          Upload file <ArrowRight size={16} />
        </button>
      </section>
      {(job || notice) && (
        <output className="rs-status">
          {job ? (
            <LoaderCircle size={18} className="rs-spin" />
          ) : (
            <Check size={18} />
          )}
          {job || notice}
        </output>
      )}
      {error && (
        <p className="rs-error" role="alert">
          {error}
        </p>
      )}

      {sources.length > 0 && (
        <div className="rs-source-picker">
          <label htmlFor="ration-source">Active document</label>
          <select
            id="ration-source"
            disabled={!!job}
            value={active?.document.documentId ?? ''}
            onChange={(event) => {
              const id = event.target.value;
              if (id)
                void run('Opening source…', async () =>
                  select(await readSource(id)),
                );
            }}
          >
            {!active && <option value="">Select a document</option>}
            {sources.map((doc) => (
              <option key={doc.document_id} value={doc.document_id}>
                {doc.name}
              </option>
            ))}
          </select>
          {active && (
            <button
              type="button"
              className="rs-secondary"
              disabled={!!job}
              onClick={() =>
                void run('Rebuilding graph…', () =>
                  buildSource(active.document.documentId),
                )
              }
            >
              {built ? 'Rebuild graph' : 'Build graph'}
            </button>
          )}
        </div>
      )}
      {active && (
        <>
          <section
            className="rs-pipeline"
            aria-label="Source to evidence pipeline"
          >
            {[
              ['Read file', `${active.document.totalChunks} source passages`],
              ['Extract concepts', `${graph.concepts.length} canonical labels`],
              [
                'Connect and check',
                `${graph.edges.length} admitted · ${graph.review.length} for review`,
              ],
              [
                'Rank and cite',
                result
                  ? `${result.evidence.length} passages · ${result.paths.length} supported paths`
                  : 'Ask a question to run',
              ],
            ].map(([label, value], index) => (
              <div key={label}>
                <span>{index + 1}</span>
                <div>
                  <h3>{label}</h3>
                  <p>{value}</p>
                </div>
              </div>
            ))}
          </section>
          <div className="rs-lab-grid">
            <section className="rs-lab-card">
              <header>
                <FileText size={18} />
                <h2>{active.document.name}</h2>
              </header>
              <div className="rs-tabs">
                <button
                  type="button"
                  aria-pressed={tab === 'graph'}
                  onClick={() => setTab('graph')}
                >
                  Source graph
                </button>
                <button
                  type="button"
                  aria-pressed={tab === 'review'}
                  onClick={() => setTab('review')}
                >
                  Review ({graph.review.length})
                </button>
                <button
                  type="button"
                  aria-pressed={tab === 'passages'}
                  onClick={() => setTab('passages')}
                >
                  Read passages
                </button>
              </div>
              {tab === 'graph' &&
                (graph.concepts.length ? (
                  <>
                    <SourceNetwork
                      key={active.document.documentId}
                      concepts={graph.concepts}
                      edges={graph.edges}
                      selected={selectedNode}
                      onSelect={setSelectedNode}
                    />
                    {selected && (
                      <div className="rs-entry">
                        <h3>{selected.canonical_name}</h3>
                        <p>
                          Recognized at{' '}
                          {sourceLocation(selected.source_location)} ·{' '}
                          {Math.round(selected.extraction_confidence * 100)}%
                          extraction heuristic
                        </p>
                        {graph.edges
                          .filter((edge) =>
                            [edge.source_entity, edge.target_entity].includes(
                              selectedNode,
                            ),
                          )
                          .slice(0, 10)
                          .map((edge) => (
                            <blockquote key={edge.candidate_id}>
                              “{edge.evidence}”
                            </blockquote>
                          ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="rs-entry">
                    No supported graph relationships were recognized. Try
                    writing one direct statement per line, such as “The Ration
                    Desk supports the Village Register.” The source remains
                    searchable after it is built.
                  </p>
                ))}
              {tab === 'review' && (
                <div className="rs-entry">
                  <p>
                    These candidates are excluded from the graph and cited
                    paths. Inspect the quote and mark it reviewed here, or
                    correct the source and upload a new version.
                  </p>
                  {graph.review.length === 0 && (
                    <p>No candidates need review for this source.</p>
                  )}
                  {graph.review.map((candidate) => (
                    <article key={candidate.candidate_id}>
                      <strong>
                        {names.get(candidate.source_entity)} →{' '}
                        {names.get(candidate.target_entity)}
                      </strong>
                      <blockquote>“{candidate.evidence}”</blockquote>
                      <p>{candidate.reason}</p>
                      <button
                        type="button"
                        className="rs-secondary"
                        aria-pressed={notes.includes(candidate.candidate_id)}
                        onClick={() => mark(candidate)}
                      >
                        {notes.includes(candidate.candidate_id)
                          ? 'Reviewed · undo'
                          : 'Mark reviewed'}
                      </button>
                    </article>
                  ))}
                </div>
              )}
              {tab === 'passages' && (
                <div className="rs-entry rs-passage-list">
                  <p>
                    Showing {active.document.chunks.length} of{' '}
                    {active.document.totalChunks} stored passages. Search checks
                    the entire selected document.
                  </p>
                  {active.document.chunks.map((chunk) => (
                    <details key={chunk.chunkId}>
                      <summary>{sourceLocation(chunk.sourceLocation)}</summary>
                      <blockquote>{chunk.text}</blockquote>
                    </details>
                  ))}
                </div>
              )}
            </section>
            <section className="rs-lab-card">
              <header>
                <Search size={18} />
                <h2>Ask this document</h2>
              </header>
              <form
                className="rs-lab-search"
                onSubmit={(event) => {
                  event.preventDefault();
                  search(query);
                }}
              >
                <label htmlFor="ration-lab-question">
                  Question about the active file
                </label>
                <input
                  id="ration-lab-question"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ask using concepts from the source"
                  maxLength={2000}
                />
                <div>
                  <button
                    className="rs-primary"
                    type="submit"
                    disabled={!!job || !built || !query.trim()}
                  >
                    Search source
                  </button>
                  {['ration-guide.csv', 'fictional-district-desk.csv'].includes(
                    active.document.name,
                  ) && (
                    <button
                      className="rs-secondary"
                      type="button"
                      disabled={!!job || !built}
                      onClick={() =>
                        search(
                          active.document.name === 'ration-guide.csv'
                            ? demoQuestion
                            : largeQuestion,
                        )
                      }
                    >
                      Try a multi-hop question
                    </button>
                  )}
                </div>
              </form>
              {result && (
                <section className="rs-query-result" aria-live="polite">
                  <p>{result.query}</p>
                  <h3>
                    {result.answerStatus === 'evidence'
                      ? 'Cited source passages'
                      : 'Insufficient evidence to answer'}
                  </h3>
                  {result.answerStatus !== 'evidence' &&
                    result.evidence.length > 0 && (
                      <p>Related passages are available for inspection.</p>
                    )}
                  <EvidenceGraph
                    key={result.resultId}
                    title="Query evidence graph"
                    edges={proofEdges(result)}
                    words={[
                      'No cited graph relationship for this query.',
                      'Read the matched passages below.',
                    ]}
                  />
                  {result.evidence.map((item, index) => (
                    <details
                      className="rs-detail"
                      key={item.chunkId}
                      open={index === 0}
                    >
                      <summary>
                        [{item.citation}] {item.source} ·{' '}
                        {sourceLocation(item.sourceLocation)}
                      </summary>
                      <blockquote>{item.excerpt ?? item.text}</blockquote>
                    </details>
                  ))}
                  {result.paths.length > 0 && (
                    <details className="rs-detail">
                      <summary>Supported paths</summary>
                      {result.paths.map((path) => (
                        <p key={path.labels.join('|')}>
                          {path.labels.join(' → ')} · [
                          {path.citationIds?.join(', ')}]
                        </p>
                      ))}
                    </details>
                  )}
                  <details className="rs-detail">
                    <summary>How the search ranked evidence</summary>
                    <ol>
                      {result.timeline.map((stage) => (
                        <li key={stage.stage}>
                          {stage.stage} · {Math.round(stage.durationMs)} ms
                        </li>
                      ))}
                    </ol>
                    <dl>
                      {result.scoreBreakdown.map((value) => (
                        <div key={value.component}>
                          <dt>{value.component}</dt>
                          <dd>
                            {value.rawScore.toFixed(2)} ×{' '}
                            {value.weight.toFixed(2)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {result.fuzzyExplanation.ruleFirings
                      .filter((rule) => rule.strength > 0)
                      .map((rule) => (
                        <p key={rule.ruleId}>
                          {rule.rule} · {rule.strength.toFixed(3)}
                        </p>
                      ))}
                    {result.warnings?.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </details>
                </section>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
