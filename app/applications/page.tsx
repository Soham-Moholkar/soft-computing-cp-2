import Link from '@/components/common/app-link';
import {
  Activity,
  Cpu,
  Factory,
  HeartPulse,
  Landmark,
  Leaf,
  Radio,
  TrendingUp,
} from 'lucide-react';
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
const applications = [
  {
    title: 'Healthcare',
    icon: HeartPulse,
    accent: 'text-red-700 bg-red-50',
    graph: 'Symptoms · conditions · treatments · evidence',
    soft: 'Fuzzy symptom strength and calibrated clinical evidence',
    example: 'Rank possible treatment evidence while showing uncertainty.',
  },
  {
    title: 'Agriculture',
    icon: Leaf,
    accent: 'text-emerald-700 bg-emerald-50',
    graph: 'Crops · diseases · climate · recommendations',
    soft: 'Approximate environmental matching and optimized advice',
    example: 'Link leaf symptoms to diseases under uncertain conditions.',
  },
  {
    title: 'Finance',
    icon: Landmark,
    accent: 'text-indigo-700 bg-indigo-50',
    graph: 'Companies · sectors · events · indicators',
    soft: 'Temporal relation weighting and multi-objective risk search',
    example: 'Trace how a sector event connects to exposed companies.',
  },
  {
    title: 'Engineering',
    icon: Factory,
    accent: 'text-amber-700 bg-amber-50',
    graph: 'Components · failures · processes · maintenance',
    soft: 'Fuzzy fault confidence and swarm path discovery',
    example: 'Rank likely failure paths from incomplete sensor evidence.',
  },
];
const comparison = [
  [
    'Uncertainty handling',
    'Explicit fuzzy memberships',
    'Probabilistic or learned confidence',
    'Often implicit in learned representations',
  ],
  [
    'Training requirement',
    'Can operate from expert rules',
    'Requires task data',
    'Usually requires substantial labeled or pretraining data',
  ],
  [
    'Interpretability',
    'High: rules and memberships',
    'Model-dependent',
    'Often limited without explanation methods',
  ],
  [
    'Optimization',
    'Metaheuristics and approximate reasoning',
    'Gradient and search methods',
    'Primarily gradient-based training',
  ],
  ['Data requirement', 'Low to moderate', 'Moderate', 'High to very high'],
  ['Computation', 'Low to moderate', 'Moderate', 'Often high'],
  [
    'Graph applicability',
    'Confidence, traversal and optimization',
    'Embeddings, link prediction and ranking',
    'Graph neural representations and extraction',
  ],
  [
    'Explainability',
    'Native linguistic explanations',
    'Post-hoc or intrinsic by model',
    'Frequently post-hoc',
  ],
];
export default function ApplicationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Unit VI · Applications and emerging trends"
        title="Where uncertainty-aware graphs matter"
        description="SoftGraph’s contracts stay domain-neutral while adapters define specialist entity types, sources, rules and evaluation metrics for healthcare, agriculture, finance and engineering."
        icon={TrendingUp}
      />
      <section
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        aria-label="Working SaaS use cases"
      >
        {[
          [
            'healthcare',
            'Care Evidence',
            'Trace handoff, referral and procedure-review documentation.',
          ],
          [
            'agriculture',
            'Field Atlas',
            'Connect field observations, crop records and water planning.',
          ],
          [
            'finance',
            'Ledger Intelligence',
            'Trace exposure reviews, treasury controls and audit evidence.',
          ],
          [
            'personal',
            'Atlas Vault',
            'Connect personal notes, reading and project ideas.',
          ],
          [
            'engineering',
            'Relay Operations',
            'Trace service dependencies and runbooks to source text.',
          ],
          [
            'course',
            'Soft Computing Studio',
            'Revise algorithm concepts and inspect cited retrieval.',
          ],
        ].map(([id, title, description]) => (
          <Link
            key={id}
            href={`/?workspace=${id}`}
            className="rounded-xl border bg-white p-6 hover:border-teal-500"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-teal-700">
              Working theoretical case study
            </p>
            <h2 className="mt-3 text-lg font-semibold">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {description}
            </p>
            <p className="mt-5 text-xs font-medium text-teal-700">
              Open isolated dashboard →
            </p>
          </Link>
        ))}
      </section>
      <Card className="border-amber-200 bg-amber-50 p-4 text-sm">
        The environments above provide working retrieval over fictional
        operational records. The broader diagnostic, forecasting and
        recommendation applications below remain conceptual; they are not
        supported by the current domain profiles.
      </Card>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {applications.map(
          ({ title, icon: Icon, accent, graph, soft, example }) => (
            <Card key={title} className="border-slate-200 p-6 shadow-none">
              <span
                className={
                  'grid size-11 place-items-center rounded-xl ' + accent
                }
              >
                <Icon className="size-5" />
              </span>
              <h2 className="mt-5 text-xl font-semibold">{title}</h2>
              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Knowledge graph
                  </p>
                  <p className="mt-1 text-sm leading-6">{graph}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Soft computing role
                  </p>
                  <p className="mt-1 text-sm leading-6">{soft}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-muted-foreground">
                  {example}
                </div>
              </div>
            </Card>
          ),
        )}
      </section>
      <section className="grid gap-5 xl:grid-cols-2">
        <Card className="border-slate-200 p-6 shadow-none">
          <div className="flex items-center gap-2">
            <Radio className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">
              Real-time incremental updates
            </h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Future events update only affected graph and vector regions while
            maintaining provenance.
          </p>
          <div className="mt-6">
            <FlowDiagram
              compact
              steps={[
                { title: 'New document' },
                { title: 'Incremental extraction' },
                { title: 'Confidence evaluation' },
                { title: 'Graph update' },
                { title: 'Index update' },
              ]}
            />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              ['Unmeasured latency target', '< 2 s'],
              ['Update scope', 'Affected subgraph'],
              ['Transport', 'REST now; WebSocket planned'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-slate-50 p-3">
                <p className="text-[10px] text-muted-foreground">{label}</p>
                <p className="mt-1 font-mono text-sm font-semibold">{value}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card className="border-slate-200 p-6 shadow-none">
          <div className="flex items-center gap-2">
            <Cpu className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Embedded and edge mode</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            A lightweight profile prioritizes privacy, bounded memory and local
            approximate retrieval.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {[
              [
                'Cached graph subsets',
                'Only task-relevant neighborhoods are synchronized.',
              ],
              [
                'Reduced fuzzy rule base',
                'High-utility rules replace the complete laboratory set.',
              ],
              [
                'Compact embeddings',
                'Smaller vectors reduce memory and compute.',
              ],
              [
                'Local approximate search',
                'Fast retrieval continues without a network connection.',
              ],
            ].map(([title, detail]) => (
              <div key={title} className="rounded-lg border p-4">
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {detail}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </section>
      <Card className="border-slate-200 p-6 shadow-none">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              Soft Computing vs Machine Learning vs Deep Learning
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The approaches complement one another; this table clarifies their
              typical strengths.
            </p>
          </div>
          <Badge variant="outline">Method selection guide</Badge>
        </div>
        <Table className="mt-5">
          <TableHeader>
            <TableRow>
              <TableHead>Dimension</TableHead>
              <TableHead>Soft Computing</TableHead>
              <TableHead>Machine Learning</TableHead>
              <TableHead>Deep Learning</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparison.map((row) => (
              <TableRow key={row[0]}>
                <TableCell className="font-medium">{row[0]}</TableCell>
                <TableCell className="text-sm">{row[1]}</TableCell>
                <TableCell className="text-sm">{row[2]}</TableCell>
                <TableCell className="text-sm">{row[3]}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Card className="border-indigo-200 bg-indigo-50 p-6 shadow-none">
        <div className="flex items-start gap-3">
          <Activity className="mt-0.5 size-5 text-indigo-700" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-800">
              Emerging direction
            </p>
            <h2 className="mt-2 text-xl font-semibold text-indigo-950">
              Graph learning can propose patterns; fuzzy and hybrid systems can
              make the uncertainty inspectable.
            </h2>
            <p className="mt-2 max-w-5xl text-sm leading-6 text-indigo-950/70">
              The Pass-2 architecture leaves model adapters open so transformer
              extraction, graph learning or domain models can be evaluated
              without turning the teaching project into an opaque monolith.
            </p>
          </div>
        </div>
      </Card>
      <EducationPanel
        title="Applications and emerging trends"
        items={{
          'What is this?':
            'Domain adaptations and lightweight operating modes built on the same core contracts.',
          'Why is it being used?':
            'Uncertainty and explainable relational reasoning occur across many disciplines.',
          'How does it work?':
            'Domain adapters extend ontology, extraction, rules and metrics without replacing the core.',
          'Where is it used in SoftGraph?':
            'Healthcare, agriculture, finance, engineering, real-time and edge profiles.',
          Inputs:
            'Domain documents, specialist rules and deployment constraints.',
          Outputs: 'Domain graph, ranked evidence and uncertainty explanation.',
          Parameters:
            'Ontology, source reliability, rule base, update latency and memory budget.',
          Example:
            'A reduced edge graph can reason locally with compact embeddings and fuzzy rules.',
        }}
      />
    </>
  );
}
