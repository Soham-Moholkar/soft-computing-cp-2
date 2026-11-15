'use client';

import { useId, useRef, useState } from 'react';
import { ArrowUpRight, FileText, Waypoints } from 'lucide-react';
import type { Policy, Rule, Version } from '@/lib/policy/catalog';
import {
  extractRequirements,
  maxDocumentCharacters,
  requirementGroups,
  type DocumentFinding,
  type RequirementGroup,
} from '@/lib/policy/extract-requirements';

interface Finding extends DocumentFinding {
  title: string;
  url?: string;
  kind:
    | 'Curated summary'
    | 'Recorded source excerpt'
    | 'Document excerpt you supplied';
}

export interface ReviewedDocument {
  title: string;
  findings: DocumentFinding[];
}

function groupRule(rule: Rule): RequirementGroup | undefined {
  if (rule.layer === 'eligibility')
    return rule.kind === 'Restriction' ? 'exclusions' : 'eligibility';
  if (rule.layer === 'documents') return 'documents';
  if (rule.layer === 'path' && /application route/i.test(rule.label))
    return 'steps';
  if (!rule.layer && rule.kind === 'Restriction') return 'exclusions';
}

function sourceFindings(version: Version): Finding[] {
  return version.rules.flatMap((rule, index) => {
    const group = groupRule(rule);
    if (!group) return [];
    const source = rule.source ?? version.source;
    const finding: Finding = {
      id: 'rule-' + index,
      line: 0,
      group,
      heading: rule.label + ' · ' + rule.target,
      passage: rule.evidence,
      title: source.title,
      locator: source.locator,
      url: source.url,
      kind: rule.verbatim ? 'Recorded source excerpt' : 'Curated summary',
    };
    if (!rule.verbatim || group === 'exclusions' || group === 'steps')
      return [finding];
    const section =
      group === 'eligibility' ? 'Eligibility:' : 'Documents required:';
    const extracted = extractRequirements(section + '\n' + rule.evidence);
    return extracted.map((item) => ({
      ...finding,
      id: finding.id + '-' + item.id,
      group: item.group,
      heading: item.heading,
      sourceContext: rule.evidence,
      line: item.line - 1,
      passage: item.passage,
      locator: source.locator + ' · Recorded line ' + (item.line - 1),
    }));
  });
}

export function EligibilityWorkspace({
  policy,
  version,
  document,
  onApply,
}: {
  policy: Policy;
  version: Version;
  document?: ReviewedDocument;
  onApply: (document?: ReviewedDocument) => void;
}) {
  const prefix = useId();
  const [selected, setSelected] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [candidates, setCandidates] = useState<ReviewedDocument>();
  const [included, setIncluded] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [reading, setReading] = useState(false);
  const fileRead = useRef(0);

  const findings: Finding[] = [
    ...sourceFindings(version),
    ...(document?.findings.map(
      (item): Finding => ({
        ...item,
        id: 'import-' + item.id,
        title: document.title,
        kind: 'Document excerpt you supplied',
      }),
    ) ?? []),
  ];
  const active = findings.find((item) => item.id === selected) ?? findings[0];
  const groups = (
    Object.entries(requirementGroups) as [RequirementGroup, string][]
  )
    .map(([group, label]) => ({
      group,
      label,
      nodes: findings.filter((item) => item.group === group),
    }))
    .sort(
      (left, right) =>
        Number(Boolean(right.nodes.length)) -
        Number(Boolean(left.nodes.length)),
    );

  function clearReview() {
    setCandidates(undefined);
    setIncluded([]);
    setStatus('');
  }

  async function readFile(file: File) {
    const token = ++fileRead.current;
    clearReview();
    setReading(true);
    setTitle('');
    setContent('');
    try {
      if (!/\.(?:txt|md|markdown)$/i.test(file.name))
        throw new Error(
          'Choose a TXT or Markdown file, or paste the excerpt below.',
        );
      if (file.size === 0 || file.size > maxDocumentCharacters * 4)
        throw new Error('Choose a nonempty file with up to 60,000 characters.');
      const text = await file.text();
      if (text.length > maxDocumentCharacters)
        throw new Error('Use an excerpt of up to 60,000 characters.');
      if (token !== fileRead.current) return;
      setTitle(file.name.slice(0, 160));
      setContent(text);
    } catch (error) {
      if (token === fileRead.current)
        setStatus(
          error instanceof Error ? error.message : 'Could not read this file.',
        );
    } finally {
      if (token === fileRead.current) setReading(false);
    }
  }

  function review() {
    clearReview();
    try {
      const result = extractRequirements(content);
      if (result.length === 0) {
        setStatus(
          content.trim()
            ? 'No requirement passages found. Include the eligibility, documents, or application section.'
            : 'Paste a policy excerpt or choose a file first.',
        );
        return;
      }
      setCandidates({
        title: title.trim() || 'Pasted policy excerpt',
        findings: result,
      });
      setIncluded(result.map((item) => item.id));
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : 'Could not read requirements.',
      );
    }
  }

  return (
    <section className="policy-eligibility" aria-labelledby={prefix + '-title'}>
      <header className="requirements-intro">
        <h3 id={prefix + '-title'}>
          <Waypoints size={19} /> Eligibility &amp; requirements graph
        </h3>
        <p>
          Select a requirement to see its evidence in {version.label}. Recorded
          source excerpts come from the indexed document snapshot.
        </p>
      </header>
      <div className="requirements-graph">
        <div className="requirements-root">
          <strong>{policy.name}</strong>
          <span>{version.label}</span>
        </div>
        <span className="requirements-relationship">
          Groups related evidence
        </span>
        <div className="policy-eligibility-grid">
          {groups.map(({ group, label, nodes }) => (
            <section
              className="policy-eligibility-card"
              key={group}
              data-active={active?.group === group}
            >
              <h4 className="requirements-group-title">{label}</h4>
              {nodes.length ? (
                <div className="requirements-nodes">
                  <span className="requirements-relationship">Contains</span>
                  {nodes.map((item) => (
                    <button
                      className="requirements-node"
                      key={item.id}
                      type="button"
                      aria-pressed={active?.id === item.id}
                      aria-controls={prefix + '-evidence'}
                      onClick={() => setSelected(item.id)}
                    >
                      {item.heading}
                      {item.id.startsWith('import-') ? ' · Added excerpt' : ''}
                    </button>
                  ))}
                </div>
              ) : (
                <p>No evidence available.</p>
              )}
            </section>
          ))}
        </div>
        <div
          className="requirements-inspector"
          id={prefix + '-evidence'}
          aria-live="polite"
        >
          <h4>Source evidence</h4>
          {active ? (
            <>
              <p>
                <strong>{active.kind}</strong> · {active.title} ·{' '}
                {active.locator}
              </p>
              {active.kind === 'Curated summary' ? (
                <p className="requirements-quote">{active.passage}</p>
              ) : (
                <blockquote className="requirements-quote">
                  {active.passage}
                </blockquote>
              )}
              {active.sourceContext &&
                active.sourceContext !== active.passage && (
                  <details className="requirements-context">
                    <summary>Read the surrounding text</summary>
                    <blockquote className="requirements-quote">
                      {active.sourceContext}
                    </blockquote>
                  </details>
                )}
              {active.url && (
                <a
                  className="policy-link"
                  href={active.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open source <ArrowUpRight size={15} />
                </a>
              )}
            </>
          ) : (
            <p>Open the programme’s official document to check its terms.</p>
          )}
        </div>
      </div>
      <p className="policy-eligibility-note">
        Check the full document for combined conditions and exceptions. The
        programme authority determines eligibility.
      </p>
      <details className="requirements-import">
        <summary>
          <FileText size={17} /> Extract from a policy document
        </summary>
        <p>
          Use text from the selected version. Paste an excerpt or choose a TXT
          or Markdown file. Your excerpt stays in this tab and its source is
          unverified.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            review();
          }}
        >
          <div className="requirements-fields">
            <label>
              Document title{' '}
              <input
                value={title}
                maxLength={160}
                onChange={(event) => {
                  setTitle(event.target.value);
                  clearReview();
                }}
                placeholder="Title as shown on the document"
              />
            </label>
            <label>
              Choose a text file{' '}
              <input
                type="file"
                accept=".txt,.md,.markdown"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void readFile(file);
                }}
              />
            </label>
            <label>
              Policy document text{' '}
              <textarea
                value={content}
                rows={6}
                maxLength={maxDocumentCharacters}
                onChange={(event) => {
                  setContent(event.target.value);
                  clearReview();
                }}
                placeholder="Paste the eligibility, exclusions, or checklist section here."
              />
            </label>
          </div>
          <div className="requirements-actions">
            <button type="submit" disabled={reading}>
              Review extracted passages
            </button>
            {document && (
              <button
                type="button"
                onClick={() => {
                  onApply();
                  setSelected('');
                }}
              >
                Remove added passages
              </button>
            )}
          </div>
        </form>
        <output className="requirements-status">
          {reading ? 'Reading file…' : status}
        </output>
        {document && <p>Showing added passages from {document.title}.</p>}
        {candidates && (
          <section className="requirements-review">
            <h4>Review {candidates.findings.length} extracted passages</h4>
            <p>
              Review the original text above for combined conditions and
              exceptions. Choose the passages that belong in this programme’s
              graph. Adding them replaces any passages you previously added for
              this version.
            </p>
            {candidates.findings.map((item) => (
              <label
                className="requirements-review-item"
                key={item.id}
                aria-label={item.heading}
              >
                <input
                  type="checkbox"
                  checked={included.includes(item.id)}
                  onChange={(event) => {
                    setIncluded((previous) =>
                      event.target.checked
                        ? [...previous, item.id]
                        : previous.filter((id) => id !== item.id),
                    );
                  }}
                />
                <span>
                  <strong>
                    {requirementGroups[item.group]} · {item.locator}
                  </strong>
                  <span>{item.passage}</span>
                </span>
              </label>
            ))}
            <div className="requirements-actions">
              <button
                type="button"
                disabled={!included.length}
                onClick={() => {
                  const accepted = candidates.findings.filter((item) =>
                    included.includes(item.id),
                  );
                  onApply({ ...candidates, findings: accepted });
                  setSelected('import-' + accepted[0].id);
                  clearReview();
                  setStatus(
                    'Added ' +
                      accepted.length +
                      (accepted.length === 1 ? ' passage' : ' passages') +
                      ' to the graph.',
                  );
                }}
              >
                Add selected passages to graph
              </button>
            </div>
          </section>
        )}
      </details>
    </section>
  );
}
