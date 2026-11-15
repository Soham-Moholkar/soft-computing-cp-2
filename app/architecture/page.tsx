import { serviceMode, apiModeMockFallbacks } from '@/services';
import { Braces, Database, Network, ServerCog } from 'lucide-react';
import { parameterRegistry } from '@/lib/parameters';
import { FlowDiagram } from '@/components/common/flow-diagram';
import { PageHeader } from '@/components/common/page-header';
import { EducationPanel } from '@/components/common/education-panel';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
const pipeline = [
  { title: 'Data sources', detail: 'TXT · PDF · CSV · JSON · URL' },
  { title: 'Ingestion', detail: 'Parse · clean · chunk' },
  { title: 'Extraction', detail: 'Entities · relations · evidence' },
  { title: 'Fuzzy confidence', detail: 'Trust · strength · validation' },
  { title: 'Entity resolution', detail: 'Aliases · ambiguity · ontology' },
  { title: 'Graph construction', detail: 'Typed nodes · fuzzy edges' },
  { title: 'Graph optimization', detail: 'GA · PSO · GWO · WOA' },
  { title: 'Storage', detail: 'SQLite workspaces · provenance' },
  { title: 'Query understanding', detail: 'Terms · workspace ontology' },
  { title: 'Path search', detail: 'BFS retrieval · actual ACO lab' },
  { title: 'Hybrid ranking', detail: 'BM25 + fixed fuzzy + graph baseline' },
  { title: 'Explanation', detail: 'Evidence · rules · score · path' },
];
const services = [
  [
    'IngestionService',
    'POST /api/ingestion/upload',
    'Parser, chunker and extraction queue',
  ],
  [
    'GraphService',
    'GET /api/graph',
    'Graph read, entity details and traversal',
  ],
  [
    'FuzzyService',
    'POST /api/fuzzy/evaluate',
    'Memberships, inference and controller',
  ],
  [
    'EvolutionaryService',
    'POST /api/optimization/jobs',
    'Seeded simplex search; candidate artifacts',
  ],
  [
    'SwarmService',
    'POST /api/optimization/jobs; /api/aco/search',
    'PSO/GWO/WOA experiments; stored-edge ACO',
  ],
  ['RetrievalService', 'POST /api/retrieve', 'Lexical, graph and fuzzy retrieval'],
  [
    'HybridService',
    'POST /api/hybrid/retrieve',
    'Combined ranking and feedback',
  ],
  [
    'ExplanationService',
    'POST /api/explanations',
    'Rule, path and score explanations',
  ],
  ['BenchmarkService', 'GET /api/benchmark', 'Experiment and metric registry'],
];
export default function ArchitecturePage() {
  return (
    <>
      <PageHeader
        eyebrow="Implemented baseline and planned modules"
        title="Complete SoftGraph architecture"
        description="Three isolated SQLite workspaces serve sources, graph evidence, cited retrieval and saved settings. API labs run recorded optimizers and train-only neuro-fuzzy experiments; benchmarks read validation artifacts. Public deployment, embeddings and reviewed-corpus model promotion remain release gates."
        icon={ServerCog}
      />
      <Card className="border-slate-200 p-6 shadow-none">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">End-to-end pipeline</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Data → knowledge → uncertainty → optimization → retrieval →
              explanation
            </p>
          </div>
          <Badge variant="outline">12 stages</Badge>
        </div>
        <div className="mt-6">
          <FlowDiagram steps={pipeline} />
        </div>
      </Card>
      <section className="grid gap-5 xl:grid-cols-3">
        {[
          {
            title: 'Experience layer',
            icon: Braces,
            accent: 'text-indigo-700 bg-indigo-50',
            items: [
              'Vinext + React + TypeScript',
              'shadcn interface primitives',
              'Recharts analytical views',
              'Interactive SVG graph workspace',
            ],
          },
          {
            title: 'Intelligence layer',
            icon: Network,
            accent: 'text-cyan-700 bg-cyan-50',
            items: [
              'Fuzzy inference and control',
              'Bounded GA and hybrid weight searches',
              'PSO/GWO/WOA experiments; stored-edge ACO',
              'Hybrid retrieval and explanation',
            ],
          },
          {
            title: 'Data layer and roadmap',
            icon: Database,
            accent: 'text-emerald-700 bg-emerald-50',
            items: [
              'FastAPI + Pydantic',
              'SQLite graph repository; Neo4j planned',
              'BM25 over saved chunks; embeddings planned',
              'Experiment and feedback store',
            ],
          },
        ].map(({ title, icon: Icon, accent, items }) => (
          <Card key={title} className="border-slate-200 p-6 shadow-none">
            <span
              className={'grid size-10 place-items-center rounded-lg ' + accent}
            >
              <Icon className="size-5" />
            </span>
            <h2 className="mt-4 text-lg font-semibold">{title}</h2>
            <ul className="mt-4 space-y-3">
              {items.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <span className="size-1.5 rounded-full bg-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </section>
      <Card className="border-slate-200 p-6 shadow-none">
        <div>
          <h2 className="text-lg font-semibold">
            Frontend service → future API map
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Mocks and REST/WebSocket implementations satisfy the same contracts.
          </p>
        </div>
        <Table className="mt-5">
          <TableHeader>
            <TableRow>
              <TableHead>Typed service</TableHead>
              <TableHead>Endpoint</TableHead>
              <TableHead>Responsibility</TableHead>
              <TableHead>Active adapter</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map(([service, endpoint, responsibility]) => (
              <TableRow key={service}>
                <TableCell className="font-mono text-xs font-semibold">
                  {service}
                </TableCell>
                <TableCell className="font-mono text-xs text-primary">
                  {endpoint}
                </TableCell>
                <TableCell>{responsibility}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {serviceMode === 'api' &&
                    !apiModeMockFallbacks.some((name) =>
                      service.toLowerCase().startsWith(name),
                    )
                      ? 'Backend REST'
                      : 'Deterministic mock'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <section>
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            Central configuration
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            Parameter registry
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Every tunable value is named, bounded and documented rather than
            buried as a magic number.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {Object.entries(parameterRegistry).map(([group, parameters]) => (
            <Card key={group} className="border-slate-200 p-5 shadow-none">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{group}</h3>
                <Badge variant="secondary">
                  {parameters.length} parameters
                </Badge>
              </div>
              <div className="mt-4 space-y-3">
                {parameters.map((parameter) => (
                  <div key={parameter.key} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-xs font-semibold text-primary">
                        {parameter.key}
                      </code>
                      <span className="font-mono text-xs">
                        {String(parameter.defaultValue)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {parameter.purpose}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      Range: {parameter.range}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>
      <EducationPanel
        title="Backend-ready architecture"
        items={{
          'What is this?':
            'A clean boundary between user experience, intelligence services and data infrastructure.',
          'Why is it being used?':
            'Pass 2 can replace mocks without redesigning every page.',
          'How does it work?':
            'Pages depend on interfaces; adapters implement local mocks or remote HTTP/WebSocket calls.',
          'Where is it used in SoftGraph?':
            'Every lab, graph view, retrieval result and benchmark.',
          Inputs:
            'Typed requests for ingestion, graphs, inference, optimization and retrieval.',
          Outputs:
            'Typed responses with provenance, confidence and explanations.',
          Parameters: 'Central registry with defaults, ranges and purpose.',
          Example:
            'MockRetrievalService becomes RestRetrievalService while RetrievalPage remains unchanged.',
        }}
      />
    </>
  );
}
