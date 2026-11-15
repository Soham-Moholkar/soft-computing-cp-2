'use client';
import { OptimizerWorkbench } from '@/components/optimization/optimizer-workbench';
import { serviceMode } from '@/services';

import { useMemo, useState } from 'react';
import { BrainCircuit, ChevronRight, RefreshCw, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EducationPanel } from '@/components/common/education-panel';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const layers = [
  { layer: 'Layer 1', title: 'Input neurons', detail: 'semantic similarity · graph distance · entity confidence · source reliability', color: 'border-slate-300 bg-slate-50' },
  { layer: 'Layer 2', title: 'Membership neurons', detail: 'Low / Medium / High sets with learnable centres and widths', color: 'border-cyan-300 bg-cyan-50' },
  { layer: 'Layer 3', title: 'Fuzzy-rule neurons', detail: 'Each neuron computes one weighted IF–THEN rule firing strength', color: 'border-indigo-300 bg-indigo-50' },
  { layer: 'Layer 4', title: 'Normalization neurons', detail: 'Rule strengths are normalized into a stable mixture', color: 'border-violet-300 bg-violet-50' },
  { layer: 'Layer 5', title: 'Output neuron', detail: 'Final retrieval relevance or entity acceptance confidence', color: 'border-emerald-300 bg-emerald-50' },
];

function HybridDemo() {
  const [semantic, setSemantic] = useState(0.87);
  const [graph, setGraph] = useState(0.78);
  const [fuzzy, setFuzzy] = useState(0.84);
  const [feedbackBoost, setFeedbackBoost] = useState(0.04);
  const result = useMemo(() => Math.min(0.99, semantic * 0.34 + graph * 0.26 + fuzzy * 0.32 + feedbackBoost), [semantic, graph, fuzzy, feedbackBoost]);

  return (
    <>
      <PageHeader
        eyebrow="Unit V · Hybrid soft computing"
        title="Hybrid intelligent systems laboratory"
        description="Combine adaptive fuzzy inference, evolutionary global search, swarm refinement and user feedback into one backend-ready retrieval architecture."
        icon={BrainCircuit}
      />

      <Tabs defaultValue="neuro-fuzzy">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="neuro-fuzzy">Neuro-Fuzzy</TabsTrigger>
          <TabsTrigger value="fuzzy-ga">Fuzzy-GA</TabsTrigger>
          <TabsTrigger value="ga-pso">GA-PSO</TabsTrigger>
          <TabsTrigger value="adaptive">Adaptive Retrieval</TabsTrigger>
        </TabsList>

        <TabsContent value="neuro-fuzzy" className="mt-4">
          <Card className="border-slate-200 p-6 shadow-none">
            <div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold">Five-layer neuro-fuzzy architecture</h2><p className="mt-1 text-sm text-muted-foreground">A transparent network whose neurons correspond to memberships, rules and normalization.</p></div><Badge variant="outline">Conceptual model</Badge></div>
            <div className="mt-7 flex items-stretch gap-2 overflow-x-auto pb-3">
              {layers.map((item, index) => (
                <div key={item.layer} className="flex shrink-0 items-center gap-2">
                  <div className={'flex w-52 flex-col justify-between rounded-xl border p-5 ' + item.color}>
                    <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{item.layer}</p><h3 className="mt-2 font-semibold">{item.title}</h3></div>
                    <p className="mt-5 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                  </div>
                  {index < layers.length - 1 && <ChevronRight className="size-5 shrink-0 text-slate-300" />}
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                ['Trainable memberships', 'centres · widths · shapes'],
                ['Trainable rules', 'weights · consequents · activation'],
                ['Explainable output', 'normalized contribution by rule'],
              ].map(([title, detail]) => <div key={title} className="rounded-lg border bg-white p-4"><p className="text-sm font-semibold">{title}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{detail}</p></div>)}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="fuzzy-ga" className="mt-4">
          <Card className="border-slate-200 p-6 shadow-none">
            <div><h2 className="text-lg font-semibold">Fuzzy system optimized by a genetic algorithm</h2><p className="mt-1 text-sm text-muted-foreground">GA searches membership centres, widths and rule weights; the fuzzy engine returns interpretable relevance.</p></div>
            <div className="mt-7 flex items-center gap-3 overflow-x-auto pb-3">
              {[
                ['GA population', 'Candidate fuzzy configurations'],
                ['Fuzzy system', 'Memberships + rules + inference'],
                ['Retrieval evaluation', 'P@K · NDCG · calibration'],
                ['Fitness', 'Quality minus noise and latency'],
                ['GA update', 'Selection · crossover · mutation'],
              ].map(([title, detail], index, all) => <div key={title} className="contents"><div className="w-52 shrink-0 rounded-xl border bg-slate-50 p-5"><p className="font-semibold">{title}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p></div>{index < all.length - 1 && <ChevronRight className="size-5 shrink-0 text-primary" />}</div>)}
            </div>
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Pass 1 visualizes the learning loop only. No claim is made that the mock configuration is experimentally optimal.</div>
          </Card>
        </TabsContent>

        <TabsContent value="ga-pso" className="mt-4">
          <section className="grid gap-5 lg:grid-cols-2">
            <Card className="border-cyan-200 bg-cyan-50 p-6 shadow-none"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-800">Stage 1 · Genetic Algorithm</p><h2 className="mt-3 text-xl font-semibold">Global evolutionary exploration</h2><p className="mt-3 text-sm leading-6 text-cyan-950/70">A diverse population identifies promising regions without assuming smoothness in the fitness surface.</p><div className="mt-5 flex gap-2">{['selection', 'crossover', 'mutation'].map((label) => <Badge key={label} variant="outline">{label}</Badge>)}</div></Card>
            <Card className="border-indigo-200 bg-indigo-50 p-6 shadow-none"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-800">Stage 2 · Particle Swarm</p><h2 className="mt-3 text-xl font-semibold">Fast local and social refinement</h2><p className="mt-3 text-sm leading-6 text-indigo-950/70">The best GA candidates initialize particles, then pBest and gBest updates fine-tune the retrieval vector.</p><div className="mt-5 flex gap-2">{['position', 'velocity', 'pBest', 'gBest'].map((label) => <Badge key={label} variant="outline">{label}</Badge>)}</div></Card>
          </section>
          <Card className="mt-5 border-slate-200 p-6 shadow-none">
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm font-semibold">
              {['GA population', 'Evolution', 'Top candidates', 'PSO initialization', 'Fine tuning', 'Optimized retrieval'].map((label, index, all) => <span key={label} className="contents"><span className="rounded-lg border bg-white px-4 py-3">{label}</span>{index < all.length - 1 && <ChevronRight className="size-4 text-slate-300" />}</span>)}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="adaptive" className="mt-4">
          <section className="grid gap-5 xl:grid-cols-[1fr_390px]">
            <Card className="border-slate-200 p-6 shadow-none">
              <div className="flex items-center gap-2"><Sparkles className="size-5 text-primary" /><h2 className="text-lg font-semibold">Adaptive relevance simulation</h2></div>
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                {[
                  ['Semantic similarity', semantic, setSemantic],
                  ['Graph relevance', graph, setGraph],
                  ['Fuzzy confidence', fuzzy, setFuzzy],
                  ['Feedback adjustment', feedbackBoost, setFeedbackBoost],
                ].map(([label, value, setter]) => (
                  <div key={String(label)}>
                    <div className="mb-2 flex justify-between text-xs"><span>{String(label)}</span><span className="font-mono">{Number(value).toFixed(2)}</span></div>
                    <Slider value={[Number(value)]} min={label === 'Feedback adjustment' ? -0.08 : 0} max={label === 'Feedback adjustment' ? 0.08 : 1} step={0.01} onValueChange={(next) => (setter as (value: number) => void)(Array.isArray(next) ? next[0] : next)} />
                  </div>
                ))}
              </div>
              <div className="mt-7 rounded-xl border border-primary/20 bg-primary/5 p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Final retrieval relevance</p>
                <p className="mt-2 font-mono text-5xl font-semibold text-primary">{result.toFixed(3)}</p>
                <p className="mt-3 text-sm text-muted-foreground">Future feedback can adjust rules, ranking weights, pheromone, entity confidence and source reliability.</p>
              </div>
            </Card>
            <Card className="border-slate-200 p-6 shadow-none">
              <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Feedback learning queue</h2><RefreshCw className="size-5 text-primary" /></div>
              <div className="mt-6 space-y-3">
                {[
                  ['Relevant', 'Increase path and source utility', '+0.04'],
                  ['Partially relevant', 'Tune ambiguous memberships', '+0.01'],
                  ['Irrelevant', 'Penalize path and evaporate pheromone', '−0.05'],
                ].map(([label, action, delta]) => <div key={label} className="rounded-lg border p-4"><div className="flex justify-between"><p className="text-sm font-semibold">{label}</p><Badge variant="outline">{delta}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{action}</p></div>)}
              </div>
              <p className="mt-5 text-xs leading-5 text-muted-foreground">No online training occurs in Pass 1. Feedback is acknowledged by the mock service and documented for the adaptive backend.</p>
            </Card>
          </section>
        </TabsContent>
      </Tabs>

      <EducationPanel title="Hybrid soft computing" items={{
        'What is this?': 'A coordinated system that combines complementary strengths of fuzzy, evolutionary, swarm and neural methods.',
        'Why is it being used?': 'One method explains uncertainty; others search and adapt system parameters.',
        'How does it work?': 'GA explores globally, PSO refines, fuzzy rules reason and feedback guides adaptation.',
        'Where is it used in SoftGraph?': 'Final retrieval, graph construction control and future learning.',
        Inputs: 'Retrieval signals, graph context, candidate configurations and feedback.',
        Outputs: 'Adaptive relevance, optimized parameters and explanations.',
        Parameters: 'Memberships, rules, thresholds, optimizer vectors and learning rates.',
        Example: 'GA tunes fuzzy sets; PSO refines ranking weights; fuzzy inference explains the result.',
      }} />
    </>
  );
}

export default function HybridPage() { return serviceMode === 'api' ? <OptimizerWorkbench initialAlgorithm="FUZZY_GA" /> : <HybridDemo />; }
