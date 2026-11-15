'use client';
import { useState } from 'react';
import {
  ArrowRight,
  Check,
  CircleDashed,
  GitBranch,
  ShieldCheck,
} from 'lucide-react';
import type { ApiGraphResponse } from '@/services/api/graph-service';
import type {
  WorkspaceId,
  WorkspaceSummary,
} from '@/services/api/workspace-service';

const scenarios = {
  healthcare: [
    {
      title: 'Care handoff',
      label: 'Coordinate the transition',
      description:
        'Follow a fictional discharge checklist into its documented follow-up workflow.',
      concepts: ['Care Handoff', 'Discharge Checklist', 'Follow Up Plan'],
      question: 'How does Care Handoff use Discharge Checklist?',
    },
    {
      title: 'Referral coordination',
      label: 'Find the next connection',
      description:
        'Trace referral records through coordinator responsibilities and follow-up documentation.',
      concepts: ['Referral Queue', 'Care Coordinator', 'Follow Up Plan'],
      question: 'How is Referral Queue related to Follow Up Plan?',
    },
    {
      title: 'Procedure review',
      label: 'Keep the evidence close',
      description:
        'Inspect the source behind procedure-library relationships. This is operational documentation, not treatment advice.',
      concepts: ['Evidence Review', 'Procedure Library', 'Care Handoff'],
      question: 'How does Evidence Review support Procedure Library?',
    },
  ],
  agriculture: [
    {
      title: 'Water planning',
      label: 'Read the field context',
      description:
        'Inspect how fictional soil-moisture records connect an irrigation plan to a water budget.',
      concepts: [
        'Irrigation Plan',
        'Soil Moisture',
        'Field Observation',
        'Water Budget',
      ],
      question: 'How does Irrigation Plan use Soil Moisture?',
    },
    {
      title: 'Crop inspection',
      label: 'Connect observations to records',
      description:
        'Follow a pest-inspection notebook into the recorded crop schedule. No diagnostic or chemical recommendation is generated.',
      concepts: ['Pest Inspection', 'Field Notebook', 'Crop Schedule'],
      question: 'How is Pest Inspection related to Crop Schedule?',
    },
    {
      title: 'Season context',
      label: 'Look beyond one observation',
      description:
        'Explore weather documentation and the budget dependencies attached to a fictional seasonal plan.',
      concepts: ['Weather Record', 'Water Budget', 'Irrigation Plan'],
      question: 'How does Weather Record support Water Budget?',
    },
  ],
  engineering: [
    {
      title: 'Incident investigation',
      label: 'Follow the documented dependency',
      description:
        'Trace the Payments API to its queue worker and incident-response runbook. These records are examples, not service telemetry.',
      concepts: ['Payments API', 'Queue Worker', 'Incident Response'],
      question: 'How is Payments API related to Queue Worker?',
    },
    {
      title: 'Release readiness',
      label: 'Make the handoff inspectable',
      description:
        'Connect a release checklist with the handoff and supporting reliability runbook.',
      concepts: ['Release Checklist', 'On Call Handoff', 'Reliability Runbook'],
      question: 'How does Release Checklist improve Incident Response?',
    },
    {
      title: 'Service ownership',
      label: 'Locate the supporting record',
      description:
        'Review the source behind ownership and response procedures before drawing an operational conclusion.',
      concepts: [
        'Service Ownership',
        'Payments API',
        'Reliability Runbook',
        'Incident Response',
      ],
      question: 'How does Incident Response use Reliability Runbook?',
    },
  ],
  finance: [
    {
      title: 'Counterparty review',
      label: 'Trace the exposure record',
      description:
        'Inspect fictional counterparty documentation and its evidence path to the risk committee.',
      concepts: ['Counterparty Review', 'Exposure Register', 'Risk Committee'],
      question: 'How does Counterparty Review use Exposure Register?',
    },
    {
      title: 'Treasury controls',
      label: 'Find the policy connection',
      description:
        'Follow a liquidity-review record into treasury policy and committee documentation. No market feed or risk prediction is used.',
      concepts: ['Liquidity Review', 'Treasury Policy', 'Risk Committee'],
      question: 'How is Liquidity Review related to Risk Committee?',
    },
    {
      title: 'Audit preparation',
      label: 'Keep the trail intact',
      description:
        'Review the chain between a control checklist, its audit trail and the evidence register.',
      concepts: ['Control Checklist', 'Audit Trail', 'Evidence Register'],
      question: 'How does Control Checklist support Audit Trail?',
    },
  ],
} as const;

export function DomainOverview({
  workspace,
  graph,
  summary,
  onSearch,
  busy,
}: {
  workspace: WorkspaceId;
  graph: ApiGraphResponse | null;
  summary: WorkspaceSummary;
  onSearch: (query: string) => void;
  busy: boolean;
}) {
  const [selected, setSelected] = useState(0);
  if (!(workspace in scenarios)) return null;
  const choices = scenarios[workspace as keyof typeof scenarios];
  const scenario = choices[selected];
  const nodes = (graph?.entities ?? []).filter((entity) =>
    (scenario.concepts as readonly string[]).includes(entity.canonical_name),
  );
  const ids = new Set(nodes.map((entity) => entity.entity_id));
  const relations = (graph?.relations ?? []).filter(
    (relation) =>
      ids.has(relation.source_entity) && ids.has(relation.target_entity),
  );
  const names = new Map(
    nodes.map((entity) => [entity.entity_id, entity.canonical_name]),
  );
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="domain-accent text-[10px] font-semibold uppercase tracking-[.16em]">
            Scenario explorer
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            {
              {
                healthcare: 'Care coordination map',
                agriculture: 'Field planning network',
                engineering: 'Service dependency map',
                finance: 'Control evidence map',
              }[workspace as keyof typeof scenarios]
            }
          </h2>
        </div>
        <span className="rounded-full border px-3 py-1.5 text-[10px] text-slate-500">
          3 fictional workflows
        </span>
      </div>
      <fieldset
        aria-label="Choose a domain scenario"
        className="mt-6 flex flex-wrap gap-2"
      >
        {choices.map((choice, index) => (
          <button
            key={choice.title}
            aria-pressed={selected === index}
            onClick={() => setSelected(index)}
            className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${selected === index ? 'domain-scenario-active' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {choice.title}
          </button>
        ))}
      </fieldset>
      <div className="domain-scenario mt-5 rounded-xl border p-5">
        <p className="text-base font-semibold">{scenario.label}</p>
        <p className="mt-2 text-xs leading-6 text-slate-600">
          {scenario.description}
        </p>
        <div
          className="mt-5 flex flex-wrap gap-2"
          aria-label="Concepts in this scenario"
        >
          {scenario.concepts.map((concept) => {
            const present = nodes.some(
              (node) => node.canonical_name === concept,
            );
            return (
              <button
                key={concept}
                disabled={busy}
                onClick={() => onSearch(concept)}
                className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs hover:border-slate-400"
                title={
                  present
                    ? 'Present in the stored graph'
                    : 'No stored graph entity yet'
                }
              >
                {present ? (
                  <Check className="domain-accent size-3" />
                ) : (
                  <CircleDashed className="size-3 text-slate-400" />
                )}
                {concept}
              </button>
            );
          })}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-200/80 pt-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              Concept coverage
            </p>
            <p className="mt-1 text-xl font-semibold">
              {nodes.length}
              <span className="text-sm font-normal text-slate-400">
                {' '}
                / {scenario.concepts.length}
              </span>
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              Supported connections
            </p>
            <p className="mt-1 text-xl font-semibold">{relations.length}</p>
          </div>
        </div>
      </div>
      <div className="mt-5">
        <p className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <GitBranch className="size-3.5" /> From the stored graph
        </p>
        {relations.length ? (
          <div className="mt-3 space-y-2">
            {relations.slice(0, 3).map((relation) => (
              <div
                key={relation.relation_id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-3 text-xs"
              >
                <span className="font-medium">
                  {names.get(relation.source_entity)}
                </span>
                <span className="domain-accent rounded-md bg-white px-2 py-1 text-[10px]">
                  {relation.relation_type}
                </span>
                <span className="font-medium">
                  {names.get(relation.target_entity)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-lg border border-dashed p-4 text-xs leading-5 text-slate-500">
            Load the example pack or import domain records to populate this
            scenario. Counts above reflect stored data.
          </p>
        )}
      </div>
      <button
        disabled={busy}
        onClick={() => onSearch(scenario.question)}
        className="domain-accent mt-5 flex items-center gap-2 text-xs font-semibold hover:underline"
      >
        Explore with cited search <ArrowRight className="size-3.5" />
      </button>
      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t pt-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="size-3.5" /> Documentation readiness
        </span>
        <span>{summary.counts.pending_jobs} pending imports</span>
        <span>{summary.counts.failed_jobs} failed imports</span>
        <span>{summary.counts.review_candidates} relations for review</span>
      </div>
    </div>
  );
}
