'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Bike,
  BookOpen,
  BriefcaseBusiness,
  FileText,
  GitCompare,
  GraduationCap,
  IndianRupee,
  MapPin,
  Search,
  SlidersHorizontal,
  Users,
  Waypoints,
} from 'lucide-react';
import type {
  EvidenceLayer,
  OfficialSource,
  Policy,
  Rule,
  Version,
} from '@/lib/policy/catalog';
import { detailedCount, fullGraphCount, policyIndex } from '@/lib/policy/index';
import {
  ambiguousWidowPhrase,
  isQueryIntent,
  queryIntents,
} from '@/lib/policy/query-intents';
import {
  jurisdictions,
  policyMatches,
  rankRules,
  selectedVersion,
  understand,
  type PolicyMatch,
} from '@/lib/policy/search';
import { EvidenceGraph, type ProofEdge } from './evidence-graph';
import './policy.css';

const topics = [
  'All topics',
  'Education',
  'Small business',
  'Food access',
  'Social support',
];
const examples = [
  {
    label: 'Find support as a widow',
    value: 'I am a widow and I need support',
    icon: Users,
  },
  {
    label: 'Find help as a single parent',
    value: 'I am a single parent and need help supporting my children',
    icon: Users,
  },
  {
    label: 'Buy an auto-rickshaw',
    value: 'I want to buy an auto-rickshaw. Can the government help?',
    icon: MapPin,
  },
  {
    label: 'Buy a bike for delivery work',
    value:
      'I work for Blinkit and want to buy a bike for delivery. Can the government help?',
    icon: Bike,
  },
  {
    label: 'Find a college scholarship',
    value: 'I need help paying college fees. What scholarships can I look at?',
    icon: GraduationCap,
  },
  {
    label: 'Start a small business',
    value: 'I want to start a small business and need a grant or loan.',
    icon: BriefcaseBusiness,
  },
];
const layers = [
  { id: 'path', title: 'Evidence graph', icon: Waypoints },
  { id: 'eligibility', title: 'Who qualifies', icon: Users },
  { id: 'funding', title: 'Money', icon: IndianRupee },
  { id: 'documents', title: 'Documents', icon: FileText },
] as const;
const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const policyById = new Map(policyIndex.map((item) => [item.id, item]));
const policyByName = new Map(policyIndex.map((item) => [item.name, item]));

function official(version: Version, rule: Rule): OfficialSource {
  return rule.source ?? version.source;
}
function ruleEdge(
  policy: Policy,
  version: Version,
  rule: Rule,
  estimate?: string,
): ProofEdge {
  const source = official(version, rule);
  return {
    id: policy.id + '/' + version.id + '/' + rule.label,
    from: rule.subject ?? policy.name,
    verb: estimate ? 'illustrates' : rule.verb,
    to: estimate ? estimate + ' · ' + rule.label : rule.target,
    quote: estimate
      ? rule.evidence +
        ' Using the entered cost, this formula illustrates ' +
        estimate +
        '.'
      : rule.evidence,
    citation: source.title + ' · ' + source.locator,
    url: source.url,
  };
}
function estimateFor(rule: Rule, cost: number) {
  const math = rule.calculation;
  if (!math || !Number.isFinite(cost) || cost <= 0 || cost > math.maxProject)
    return undefined;
  return inr.format(Math.min(cost * math.rate, math.cap ?? Infinity));
}
function graphFor(
  policy: Policy,
  version: Version,
  query: string,
  layer: EvidenceLayer,
  cost: number,
  comparing?: Version,
) {
  const ranked = rankRules(version, query);
  const hasEligibility = ranked.some((rule) => rule.layer === 'eligibility');
  const rules = ranked.filter((rule) =>
    layer === 'eligibility' && !hasEligibility
      ? !rule.layer && rule.kind === 'Restriction'
      : (rule.layer ?? 'path') === layer ||
        (layer === 'path' && rule.layer === 'eligibility'),
  );
  const direct = rules.map((rule) =>
    ruleEdge(policy, version, rule, estimateFor(rule, cost)),
  );
  if (layer !== 'path') return direct;
  const connected = direct.flatMap((edge) => {
    const related = policyByName.get(edge.to);
    if (!related || related.id === policy.id) return [];
    return rankRules(related.versions[0], query)
      .filter((rule) => rule.kind === 'Programme link')
      .slice(0, 2)
      .map((rule) => ruleEdge(related, related.versions[0], rule));
  });
  const edges = [...direct, ...connected].slice(0, 7);
  if (comparing && policy.versions.length === 2) {
    const [recent, earlier] = policy.versions;
    if (
      ['svanidhi', 'mudra', 'csss', 'pmedrive', 'ignwps'].includes(policy.id)
    ) {
      edges.unshift({
        id: policy.id + '/change',
        from: recent.label,
        verb:
          policy.id === 'csss'
            ? 'describes a later academic year than'
            : 'updates the rules in',
        to: earlier.label,
        quote: recent.summary,
        citation: recent.source.title + ' · ' + recent.source.locator,
        url: recent.source.url,
      });
    }
  }
  return edges;
}

export function PolicyExplorer() {
  const [query, setQuery] = useState('');
  const [asked, setAsked] = useState('');
  const [topic, setTopic] = useState('All topics');
  const [location, setLocation] = useState('All locations');
  const [use, setUse] = useState('From question');
  const [picked, setPicked] = useState('');
  const [versionId, setVersionId] = useState('');
  const [compare, setCompare] = useState('');
  const [layer, setLayer] = useState<EvidenceLayer>('path');
  const [cost, setCost] = useState('');
  const [limit, setLimit] = useState(7);
  const interpretationTask = useRef<AbortController | null>(null);
  const [suggestion, setSuggestion] = useState('');
  const [interpretationStatus, setInterpretationStatus] = useState('');
  useEffect(() => () => interpretationTask.current?.abort(), []);
  const plan = useMemo(() => {
    const interpreted = understand(asked, location);
    if (interpreted.asset && use !== 'From question') {
      return {
        ...interpreted,
        use:
          use === 'Personal use'
            ? ('Personal use' as const)
            : ('Commercial use' as const),
      };
    }
    return interpreted;
  }, [asked, location, use]);
  const matches = useMemo(
    () => policyMatches(asked, topic, plan),
    [asked, topic, plan],
  );
  const active =
    matches.find((result) => result.policy.id === picked) ?? matches[0];
  const policy = active?.policy;
  const chosen = policy ? selectedVersion(policy, asked) : null;
  const version =
    policy?.versions.find((item) => item.id === versionId) ?? chosen?.version;
  const other = policy?.versions.find(
    (item) => item.id === compare && item.id !== version?.id,
  );
  const interpretedLabels = [
    ['Goal', plan.goal],
    [
      'Vehicle',
      plan.asset === 'two-wheeler'
        ? 'Two-wheeler'
        : plan.asset === 'three-wheeler'
          ? 'Three-wheeler'
          : '',
    ],
    ['Work context', plan.audience],
    ['Situation', plan.circumstance],
    ['Looking for', plan.request],
    ['Use', plan.use || (plan.asset ? 'Unspecified' : '')],
    [
      'Fuel',
      plan.electric
        ? 'Electric'
        : plan.petrol
          ? 'Fuel-powered'
          : plan.asset
            ? 'Unspecified'
            : '',
    ],
    ['Location', plan.state || 'All locations'],
  ].filter(([, value]) => value);

  function pick(id: string) {
    setPicked(id);
    setVersionId('');
    setCompare('');
    setLayer('path');
  }
  function ask(value: string) {
    interpretationTask.current?.abort();
    setSuggestion('');
    setInterpretationStatus('');
    setQuery(value);
    setAsked(value.trim());
    setLimit(7);
    pick('');
    const request = understand(value).request;
    if (request === 'Money') setLayer('funding');
    if (request === 'Documents') setLayer('documents');
    if (request === 'Eligibility') setLayer('eligibility');
  }

  async function interpretLocally() {
    interpretationTask.current?.abort();
    const controller = new AbortController();
    interpretationTask.current = controller;
    setSuggestion('');
    setInterpretationStatus('Checking your wording with the local model…');
    try {
      const response = await fetch('/api/policy/interpret', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: asked }),
        signal: controller.signal,
      });
      const result = (await response.json()) as {
        status?: unknown;
        intent?: unknown;
      } | null;
      if (controller.signal.aborted) return;
      if (result?.status === 'ready' && isQueryIntent(result.intent)) {
        const candidate = queryIntents[result.intent];
        setSuggestion(candidate);
        setInterpretationStatus(
          candidate
            ? 'Did you mean this?'
            : 'Try describing who needs help and what they need.',
        );
      } else {
        setInterpretationStatus(
          'The local model is unavailable. You can reword your search or try the official directory.',
        );
      }
    } catch {
      if (!controller.signal.aborted)
        setInterpretationStatus(
          'The local model is unavailable. You can reword your search or try the official directory.',
        );
    }
  }

  const numberCost = Number(cost);
  const edges =
    policy && version
      ? graphFor(policy, version, asked, layer, numberCost, other)
      : [];

  return (
    <div className="policy-explorer">
      <section className="policy-banner">
        <div className="policy-banner-copy">
          <p className="policy-kicker">
            <BookOpen size={16} /> India Policy Explorer
          </p>
          <h1>
            What do you need
            <br /> help <em>paying for?</em>
          </h1>
          <p>
            Describe your situation. Find government programmes, compare the
            money and paperwork, and see the official rule behind each
            connection.
          </p>
          <form
            className="policy-form"
            onSubmit={(event) => {
              event.preventDefault();
              ask(query);
            }}
          >
            <label htmlFor="policy-query">Ask in your own words</label>
            <div className="policy-form-field">
              <Search size={19} />
              <input
                id="policy-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="I deliver groceries and need a bike for work…"
                maxLength={300}
              />
              <button type="submit">
                Find support <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </div>
        <aside className="policy-story" aria-label="Example scenario">
          <span>Explore a real scenario</span>
          <button type="button" onClick={() => ask(examples[0].value)}>
            Buying a vehicle for work <ArrowUpRight size={19} />
          </button>
        </aside>
      </section>
      <div className="policy-examples" aria-label="Examples">
        {examples.map(({ label, value, icon: Icon }) => (
          <button type="button" key={label} onClick={() => ask(value)}>
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
      <section
        className="policy-context"
        aria-label="Query interpretation and filters"
      >
        <div className="policy-filters">
          <div>
            <label htmlFor="policy-topic">Topic</label>
            <select
              id="policy-topic"
              value={topic}
              onChange={(event) => {
                setTopic(event.target.value);
                setLimit(7);
                pick('');
              }}
            >
              {topics.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="policy-state">State</label>
            <select
              id="policy-state"
              value={location}
              onChange={(event) => {
                setLocation(event.target.value);
                setLimit(7);
                pick('');
              }}
            >
              {jurisdictions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          {plan.asset && (
            <div>
              <label htmlFor="policy-use">Vehicle use</label>
              <select
                id="policy-use"
                value={use}
                onChange={(event) => {
                  setUse(event.target.value);
                  pick('');
                }}
              >
                <option>From question</option>
                <option>Commercial use</option>
                <option>Personal use</option>
              </select>
            </div>
          )}
        </div>
        {asked && (
          <div className="policy-interpretation" aria-live="polite">
            <h2>
              <SlidersHorizontal size={15} /> How we read your question
            </h2>
            <dl>
              {interpretedLabels.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {plan.circumstance && !plan.state && (
              <p>
                Choose your state to see local amounts and application routes.
              </p>
            )}
            {(!plan.goal || !matches.length) && (
              <div className="policy-clarify">
                {ambiguousWidowPhrase(asked) && (
                  <button
                    type="button"
                    className="policy-link"
                    onClick={() => {
                      setTopic('All topics');
                      ask('widow support');
                    }}
                  >
                    Did you mean widow support?
                  </button>
                )}
                <button
                  type="button"
                  className="policy-link"
                  disabled={
                    interpretationStatus.startsWith('Checking') ||
                    asked.length > 600
                  }
                  onClick={interpretLocally}
                >
                  Try local interpretation
                </button>
                <output>{interpretationStatus}</output>
                {suggestion && (
                  <button
                    type="button"
                    className="policy-link"
                    onClick={() => {
                      setTopic('All topics');
                      ask(asked + ' ' + suggestion);
                    }}
                  >
                    Search for {suggestion}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <div className="policy-workbench">
        <aside className="policy-shelf">
          <div className="policy-shelf-head">
            <h2>{asked ? 'Programmes to explore' : 'Browse programmes'}</h2>
            <p aria-live="polite">
              {matches.length} {matches.length === 1 ? 'match' : 'matches'}
            </p>
          </div>
          {matches.slice(0, limit).map((match) => (
            <MatchCard
              key={match.policy.id}
              match={match}
              selected={match.policy.id === policy?.id}
              onPick={() => pick(match.policy.id)}
            />
          ))}
          {matches.length > limit && (
            <button
              type="button"
              className="policy-more"
              onClick={() => setLimit(limit + 12)}
            >
              Show more <ArrowRight size={14} />
            </button>
          )}
        </aside>
        <div className="policy-output">
          {!active || !policy || !version ? (
            <section className="rs-result-card policy-card">
              <h2>There’s no matching policy in this collection.</h2>
              <p>
                Change a filter, try a broader description, or open the official
                national directory.
              </p>
              <a
                href="https://www.myscheme.gov.in/"
                target="_blank"
                rel="noreferrer"
                className="policy-link"
              >
                Open myScheme <ArrowUpRight size={15} />
              </a>
            </section>
          ) : (
            <section className="rs-result-card policy-card">
              <header className="policy-detail-header">
                <div className="policy-tags">
                  <span>{policy.state ?? 'Central'}</span>
                  <span>{policy.topic}</span>
                  {policy.fundingType && <span>{policy.fundingType}</span>}
                </div>
                <h2>{policy.name}</h2>
                <p>{version.summary}</p>
                <p className="policy-fit-note">{active.explanation}</p>
                <div className="policy-version">
                  <div>
                    <label htmlFor="policy-version">Document version</label>
                    <select
                      id="policy-version"
                      value={version.id}
                      onChange={(event) => {
                        setVersionId(event.target.value);
                        setCompare('');
                      }}
                    >
                      {policy.versions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {policy.versions.length > 1 && (
                    <div>
                      <label htmlFor="policy-compare">
                        <GitCompare size={14} /> Compare with
                      </label>
                      <select
                        id="policy-compare"
                        value={compare}
                        onChange={(event) => setCompare(event.target.value)}
                      >
                        <option value="">Choose a version</option>
                        {policy.versions
                          .filter((item) => item.id !== version.id)
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.label}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                  <a
                    href={version.source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="policy-link"
                  >
                    Open official document <ArrowUpRight size={15} />
                  </a>
                </div>
                {chosen?.missingYear && !versionId && (
                  <p className="policy-notice">
                    No matching indexed document for {chosen.missingYear}.
                    Showing {version.label}.
                  </p>
                )}
              </header>
              {other && <VersionComparison first={version} second={other} />}
              <div className="policy-tabs" aria-label="Type of evidence">
                {layers.map(({ id, title, icon: Icon }) => (
                  <button
                    type="button"
                    key={id}
                    aria-pressed={layer === id}
                    onClick={() => setLayer(id)}
                  >
                    <Icon size={17} />
                    {title}
                  </button>
                ))}
              </div>
              {layer === 'funding' && (
                <section className="policy-layer-intro">
                  <h3>Published amounts</h3>
                  <p>
                    Each amount has its own source and conditions. Loan limits
                    and subsidies describe different kinds of support.
                  </p>
                  {version.rules.some((rule) => rule.calculation) && (
                    <div className="policy-cost">
                      <label htmlFor="policy-cost">
                        Illustrate with a project cost (₹)
                      </label>
                      <input
                        id="policy-cost"
                        type="number"
                        min="1"
                        value={cost}
                        onChange={(event) => setCost(event.target.value)}
                        placeholder="250000"
                      />
                      <p>
                        Illustration using the published rates for the indexed
                        project category. The example doesn’t determine
                        approval.
                      </p>
                    </div>
                  )}
                  {version.rules.some(
                    (rule) =>
                      rule.calculation &&
                      numberCost > rule.calculation.maxProject,
                  ) && (
                    <p className="policy-notice">
                      This cost exceeds an indexed scenario’s project ceiling.
                      The graph shows its published terms.
                    </p>
                  )}
                </section>
              )}
              {layer === 'documents' && (
                <section className="policy-layer-intro">
                  <h3>Documents and application steps</h3>
                  <p>
                    Open a connection to see the checklist and its official
                    location. Use the official service to submit documents.
                  </p>
                </section>
              )}
              <div className="policy-proof">
                <EvidenceGraph
                  key={[
                    policy.id,
                    version.id,
                    asked,
                    compare,
                    layer,
                    cost,
                  ].join('|')}
                  edges={edges}
                  title={
                    layer === 'path'
                      ? 'Policy evidence graph'
                      : layer === 'eligibility'
                        ? 'Eligibility evidence graph'
                        : layer === 'funding'
                          ? 'Funding evidence graph'
                          : 'Document evidence graph'
                  }
                  words={[
                    layer === 'path'
                      ? 'No relationship is indexed for this view.'
                      : layer === 'eligibility'
                        ? 'No eligibility criteria are indexed for this version.'
                        : layer === 'funding'
                          ? 'No amount is indexed for this version.'
                          : 'No checklist is indexed for this version.',
                    'Open the official document for details.',
                  ]}
                />
              </div>
              {policy.similar?.length ? (
                <div className="policy-related">
                  <p>Explore another programme in this area</p>
                  {policy.similar.map((id) => {
                    const item = policyById.get(id);
                    return (
                      item && (
                        <button
                          type="button"
                          key={id}
                          className="policy-link"
                          onClick={() => {
                            setTopic('All topics');
                            ask(item.name);
                            setPicked(item.id);
                          }}
                        >
                          {item.name} <ArrowRight size={14} />
                        </button>
                      )
                    );
                  })}
                </div>
              ) : null}
              {asked && (
                <details className="policy-ranking">
                  <summary>Why this programme appeared</summary>
                  <p>
                    {active.explanation} The score uses graded matches. It ranks
                    the search results.
                  </p>
                  <dl>
                    {Object.entries(active.signals).map(([label, signal]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{Math.round(signal * 100)} / 100</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}
            </section>
          )}
        </div>
      </div>
      <footer className="policy-footer">
        {policyIndex.length} indexed entries · {detailedCount} evidence profiles
        · {fullGraphCount} with money, eligibility and document graphs. Use
        official documents and agencies to confirm current application terms.
      </footer>
    </div>
  );
}

function MatchCard({
  match,
  selected,
  onPick,
}: {
  match: PolicyMatch;
  selected: boolean;
  onPick: () => void;
}) {
  const policy = match.policy;
  return (
    <button
      className="policy-match"
      type="button"
      aria-pressed={selected}
      onClick={onPick}
    >
      <span className="policy-match-type">
        {policy.state ?? 'Central'}
        {policy.fundingType ? ' · ' + policy.fundingType : ''}
      </span>
      <strong>{policy.name}</strong>
      <span>{match.fit}</span>
    </button>
  );
}

function VersionComparison({
  first,
  second,
}: {
  first: Version;
  second: Version;
}) {
  const labels = [
    ...new Set([...first.rules, ...second.rules].map((rule) => rule.label)),
  ];
  return (
    <div className="policy-comparison">
      <table>
        <caption>Rules in each document</caption>
        <thead>
          <tr>
            <th scope="col">Rule</th>
            {[first, second].map((version) => (
              <th scope="col" key={version.id}>
                <a href={version.source.url} target="_blank" rel="noreferrer">
                  {version.label}
                </a>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {[first, second].map((version) => {
                const rule = version.rules.find((item) => item.label === label);
                const source = rule ? official(version, rule) : version.source;
                return (
                  <td key={version.id}>
                    {rule ? (
                      <a
                        href={source.url}
                        title={source.title}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {rule.target}
                      </a>
                    ) : (
                      'No indexed value'
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
