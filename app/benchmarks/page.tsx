import { EvaluationDashboard } from '@/components/optimization/evaluation-dashboard';
import { serviceMode } from '@/services';
import { ChartNoAxesCombined, TriangleAlert } from 'lucide-react';
import { services } from '@/services';
import { ScoreBars } from '@/components/charts/score-bars';
import { DemoBadge, PageHeader } from '@/components/common/page-header';
import { EducationPanel } from '@/components/common/education-panel';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default async function BenchmarksPage() {
  if (serviceMode === 'api') return <EvaluationDashboard />;
  const results = await services.benchmark.getResults();
  const hybrid = results[results.length - 1];
  return (
    <>
      <PageHeader
        eyebrow="Evaluation workbench"
        title="Algorithm benchmarking"
        description="Compare the deterministic teaching baseline, fuzzy reasoning, optimized systems, ACO retrieval and the hybrid pipeline across retrieval quality, graph quality, latency and noise."
        icon={ChartNoAxesCombined}
        actions={<DemoBadge>MOCK EXPERIMENTAL DATA</DemoBadge>}
      />

      <Card className="border-amber-200 bg-amber-50 p-5 shadow-none">
        <div className="flex items-start gap-3"><TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-700" /><div><p className="font-semibold text-amber-950">Scientific integrity notice</p><p className="mt-1 text-sm leading-6 text-amber-900/75">Every value on this page is simulated for interface and syllabus demonstration. It is not empirical evidence and must be replaced by reproducible Pass-2 experiments.</p></div></div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Precision@K', hybrid.precisionAtK],
          ['Recall@K', hybrid.recallAtK],
          ['F1', hybrid.f1],
          ['MRR', hybrid.mrr],
          ['NDCG', hybrid.ndcg],
          ['Entity resolution', hybrid.entityResolutionAccuracy],
          ['Relation accuracy', hybrid.relationAccuracy],
          ['Noise ratio', hybrid.graphNoiseRatio],
        ].map(([label, value]) => (
          <Card key={String(label)} className="border-slate-200 p-5 shadow-none"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 font-mono text-3xl font-semibold">{Number(value).toFixed(3)}</p><p className="mt-1 text-[10px] text-amber-700">SIMULATED</p></Card>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[430px_1fr]">
        <Card className="border-slate-200 p-6 shadow-none">
          <h2 className="text-lg font-semibold">NDCG by system</h2>
          <p className="mt-1 text-sm text-muted-foreground">Illustrative ranking-quality comparison</p>
          <ScoreBars data={results.map((item) => ({ name: item.system.replace(' Computing', '').replace(' optimized', ''), value: item.ndcg }))} color="#4f46e5" />
        </Card>
        <Card className="border-slate-200 p-6 shadow-none">
          <h2 className="text-lg font-semibold">Complete mock benchmark</h2>
          <Table className="mt-4">
            <TableHeader><TableRow><TableHead>System</TableHead><TableHead>P@K</TableHead><TableHead>R@K</TableHead><TableHead>F1</TableHead><TableHead>MRR</TableHead><TableHead>NDCG</TableHead><TableHead>Latency</TableHead><TableHead>Noise</TableHead></TableRow></TableHeader>
            <TableBody>{results.map((item) => <TableRow key={item.system}><TableCell className="font-medium">{item.system}</TableCell><TableCell>{item.precisionAtK.toFixed(2)}</TableCell><TableCell>{item.recallAtK.toFixed(2)}</TableCell><TableCell>{item.f1.toFixed(2)}</TableCell><TableCell>{item.mrr.toFixed(2)}</TableCell><TableCell className="font-semibold text-primary">{item.ndcg.toFixed(2)}</TableCell><TableCell>{item.latencyMs} ms</TableCell><TableCell>{item.graphNoiseRatio?.toFixed(2) ?? 'n/a'}</TableCell></TableRow>)}</TableBody>
          </Table>
        </Card>
      </section>

      <section>
        <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Graph extraction snapshot</p><h2 className="mt-1 text-xl font-semibold">Quality and structure metrics</h2></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {[
            ['Extraction precision', '0.86'],
            ['Extraction recall', '0.83'],
            ['Entities', '42'],
            ['Relations', '78'],
            ['Graph density', '0.091'],
            ['Average confidence', '0.864'],
            ['Latency', '118 ms'],
          ].map(([label, value]) => <Card key={label} className="border-slate-200 p-4 shadow-none"><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-2 font-mono text-xl font-semibold">{value}</p></Card>)}
        </div>
      </section>

      <EducationPanel title="Evaluation" items={{
        'What is this?': 'A multi-metric comparison framework for retrieval and graph construction.',
        'Why is it being used?': 'Accuracy alone can hide latency, noise and graph-coherence trade-offs.',
        'How does it work?': 'Run identical datasets and query sets across ablation configurations.',
        'Where is it used in SoftGraph?': 'Optimizer fitness, regression checks and scientific reporting.',
        Inputs: 'Gold entities, relations, relevance judgments and execution traces.',
        Outputs: 'P@K, R@K, F1, MRR, NDCG, extraction metrics, latency and noise.',
        Parameters: 'K, folds, seeds, ablations, confidence intervals and significance tests.',
        Example: 'Compare the hard threshold baseline with fuzzy and hybrid retrieval.',
      }} />
    </>
  );
}
