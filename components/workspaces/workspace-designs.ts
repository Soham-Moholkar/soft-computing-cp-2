import {
  BookOpen,
  Workflow,
  FlaskConical,
  HeartPulse,
  Sprout,
  Landmark,
} from 'lucide-react';
export const designs = {
  healthcare: {
    icon: HeartPulse,
    color: 'bg-rose-100 text-rose-800',
    eyebrow: 'CARE EVIDENCE / HEALTHCARE OPERATIONS',
    title: 'Connected evidence. Clearer handoffs.',
    action: 'Add procedure',
    sources: 'Procedures',
    graph: 'Care pathways',
    overview: 'Care desk',
    body: 'A dedicated evidence workspace for care coordination, referral workflows and procedure review.',
    workflow: [
      'Capture a procedure',
      'Trace the handoff',
      'Inspect source evidence',
    ],
    input:
      'Fictional handoff procedures, referral notes and evidence-review records',
    outcome:
      'Find documented operational relationships without generating treatment recommendations.',
    integration:
      'Import approved, de-identified text or files. EHR connectivity is not enabled.',
  },
  agriculture: {
    icon: Sprout,
    color: 'bg-lime-100 text-lime-900',
    eyebrow: 'FIELD ATLAS / AGRICULTURE PLANNING',
    title: 'A clearer picture of every field.',
    action: 'Add field record',
    sources: 'Field records',
    graph: 'Field network',
    overview: 'Field desk',
    body: 'Connect crop schedules, observation records and irrigation documentation in one focused environment.',
    workflow: [
      'Record an observation',
      'Connect field context',
      'Review the documented plan',
    ],
    input:
      'Fictional field notebooks, water budgets, weather records and inspection notes',
    outcome:
      'Explore recorded planning dependencies and uncertain observations.',
    integration:
      'Text and structured imports work today. Sensor feeds and farm-system sync are not enabled.',
  },
  finance: {
    icon: Landmark,
    color: 'bg-indigo-100 text-indigo-800',
    eyebrow: 'LEDGER INTELLIGENCE / FINANCE CONTROLS',
    title: 'Every control. A traceable source.',
    action: 'Add control record',
    sources: 'Control records',
    graph: 'Evidence network',
    overview: 'Control desk',
    body: 'Follow exposure documentation, treasury policies and audit evidence through a dedicated control workspace.',
    workflow: [
      'Import a control record',
      'Trace the evidence chain',
      'Review the source',
    ],
    input:
      'Fictional counterparty files, audit trails and treasury review documentation',
    outcome:
      'Retrieve control evidence without generating investment advice or risk ratings.',
    integration:
      'File and paste imports work today. Market feeds and accounting-system sync are not enabled.',
  },

  personal: {
    icon: BookOpen,
    color: 'bg-violet-100 text-violet-800',
    eyebrow: 'MAKE ROOM FOR CONNECTIONS',
    title: 'Your notes, with a little more perspective.',
    action: 'New note',
    sources: 'Notes',
    graph: 'Connections',
    overview: 'Vault',
    body: 'Bring research, daily notes and project ideas into one searchable vault.',
    workflow: [
      'Capture a note',
      'Connect supported concepts',
      'Follow the source',
    ],
    input: 'Markdown notes, reading excerpts and project journals',
    outcome:
      'Discover documented connections while keeping tentative ideas visible.',
    integration:
      'Markdown, text and paste imports work today. Vault sync is a future integration.',
  },
  engineering: {
    icon: Workflow,
    color: 'bg-teal-100 text-teal-800',
    eyebrow: 'KNOWLEDGE THAT HOLDS UP UNDER PRESSURE',
    title: 'Every dependency, documented.',
    action: 'Add runbook',
    sources: 'Runbooks',
    graph: 'Dependencies',
    overview: 'Operations',
    body: 'Connect service notes, release checklists and incident response knowledge.',
    workflow: [
      'Document a service',
      'Trace a dependency',
      'Inspect the runbook',
    ],
    input: 'Runbooks, dependency notes, handoffs and release checklists',
    outcome:
      'Find documented paths between services and procedures during investigation.',
    integration:
      'File and paste imports work today. Git, incident and ticket connectors are future integrations.',
  },
  course: {
    icon: FlaskConical,
    color: 'bg-blue-100 text-blue-800',
    eyebrow: 'FROM CONCEPTS TO UNDERSTANDING',
    title: 'A study space that shows its working.',
    action: 'Add study source',
    sources: 'Study sources',
    graph: 'Concept map',
    overview: 'Revision',
    body: 'Explore soft computing through revision sources and inspectable graph paths.',
    workflow: [
      'Import a source',
      'Explore an algorithm',
      'Check the cited excerpt',
    ],
    input:
      'Course notes, readable PDFs, algorithm summaries and structured examples',
    outcome:
      'Compare retrieval methods and navigate concepts with source provenance.',
    integration:
      'PDF, text, CSV and JSON imports work today. LMS sync is a future integration.',
  },
} as const;
