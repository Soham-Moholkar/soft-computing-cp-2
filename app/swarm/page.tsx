'use client';
import { OptimizerWorkbench } from '@/components/optimization/optimizer-workbench';
import { serviceMode } from '@/services';

import { useEffect, useState } from 'react';
import { Atom, Bug, Fish, PawPrint, RadioTower } from 'lucide-react';
import type { OptimizerRun } from '@/lib/types';
import { swarmComparison } from '@/data/benchmarks';
import { services } from '@/services';
import { ConvergenceChart } from '@/components/charts/convergence-chart';
import { ScoreBars } from '@/components/charts/score-bars';
import { EducationPanel } from '@/components/common/education-panel';
import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function SwarmDemo() {
  const [iterations, setIterations] = useState(36);
  const [psoRun, setPsoRun] = useState<OptimizerRun | null>(null);
  const [gwoRun, setGwoRun] = useState<OptimizerRun | null>(null);
  const [woaRun, setWoaRun] = useState<OptimizerRun | null>(null);
  const [paths, setPaths] = useState<
    Array<{ labels: string[]; score: number; pheromone: number }>
  >([]);

  useEffect(() => {
    void Promise.all([
      services.swarm.optimize('PSO', iterations),
      services.swarm.optimize('GWO', iterations),
      services.swarm.optimize('WOA', iterations),
      services.swarm.searchGraph(
        'How does swarm intelligence improve retrieval?',
        4,
      ),
    ]).then(([pso, gwo, woa, acoPaths]) => {
      setPsoRun(pso);
      setGwoRun(gwo);
      setWoaRun(woa);
      setPaths(acoPaths);
    });
  }, [iterations]);

  return (
    <>
      <PageHeader
        eyebrow="Unit IV · Collective intelligence"
        title="Swarm intelligence laboratory"
        description="Compare four nature-inspired search strategies: PSO tunes retrieval parameters, ACO explores reasoning paths, GWO selects subgraphs and WOA searches pruning configurations."
        icon={Atom}
      />

      <Card className="border-slate-200 p-5 shadow-none">
        <div className="grid gap-5 md:grid-cols-[250px_1fr] md:items-center">
          <div>
            <p className="text-sm font-semibold">Simulation iterations</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Affects each deterministic convergence trace.
            </p>
          </div>
          <div>
            <div className="mb-2 flex justify-between text-xs">
              <span>10</span>
              <span className="font-mono font-semibold text-primary">
                {iterations} iterations
              </span>
              <span>80</span>
            </div>
            <Slider
              value={[iterations]}
              min={10}
              max={80}
              step={1}
              onValueChange={(value) =>
                setIterations(Array.isArray(value) ? value[0] : value)
              }
            />
          </div>
        </div>
      </Card>

      <Tabs defaultValue="pso">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="pso">PSO</TabsTrigger>
          <TabsTrigger value="aco">ACO</TabsTrigger>
          <TabsTrigger value="gwo">GWO</TabsTrigger>
          <TabsTrigger value="woa">WOA</TabsTrigger>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
        </TabsList>

        <TabsContent value="pso" className="mt-4">
          <section className="grid gap-5 xl:grid-cols-[1fr_370px]">
            <Card className="border-slate-200 p-6 shadow-none">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">PSO convergence</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Particles tune semantic, fuzzy, graph, centrality, recency
                    and source weights.
                  </p>
                </div>
                <RadioTower className="size-5 text-primary" />
              </div>
              <ConvergenceChart
                data={psoRun?.convergence ?? []}
                color="#0891b2"
              />
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ['Position', '[0.29, 0.19, 0.20, …]'],
                  ['Velocity', '[+0.02, −0.01, +0.01, …]'],
                  ['Global best', psoRun?.bestFitness.toFixed(3) ?? '—'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                    <p className="mt-1 font-mono text-sm">{value}</p>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="border-slate-200 p-6 shadow-none">
              <h2 className="text-lg font-semibold">Particle state</h2>
              <div className="mt-5 space-y-3">
                {[
                  ['P-01', 0.918, 'gBest'],
                  ['P-12', 0.903, 'pBest'],
                  ['P-07', 0.891, 'pBest'],
                  ['P-21', 0.874, 'exploring'],
                  ['P-18', 0.861, 'exploring'],
                ].map(([particle, fitness, state]) => (
                  <div
                    key={String(particle)}
                    className="grid grid-cols-[48px_1fr_auto] items-center gap-3"
                  >
                    <span className="grid size-10 place-items-center rounded-full bg-cyan-50 font-mono text-xs text-cyan-700">
                      {particle}
                    </span>
                    <div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full bg-cyan-600"
                          style={{ width: Number(fitness) * 100 + '%' }}
                        />
                      </div>
                      <p className="mt-1 font-mono text-[10px]">
                        {Number(fitness).toFixed(3)}
                      </p>
                    </div>
                    <Badge variant={state === 'gBest' ? 'default' : 'outline'}>
                      {state}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-lg border p-3 font-mono text-[11px] leading-5 text-muted-foreground">
                v(t+1) = wv + c₁r₁(pBest−x) + c₂r₂(gBest−x)
                <br />
                x(t+1) = x(t) + v(t+1)
              </div>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="aco" className="mt-4">
          <section className="grid gap-5 xl:grid-cols-[1fr_390px]">
            <Card className="border-slate-200 p-6 shadow-none">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    ACO multi-hop path exploration
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ants favor edges with strong pheromone history and semantic
                    desirability.
                  </p>
                </div>
                <Bug className="size-5 text-amber-600" />
              </div>
              <div className="mt-6 space-y-4">
                {paths.map((path, index) => (
                  <div
                    key={path.labels.join('-')}
                    className={
                      index === 0
                        ? 'rounded-xl border border-amber-300 bg-amber-50 p-5'
                        : 'rounded-xl border p-5'
                    }
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant={index === 0 ? 'default' : 'outline'}>
                        {index === 0 ? 'Best path' : 'Candidate ' + (index + 1)}
                      </Badge>
                      <span className="font-mono text-xs">
                        score {path.score.toFixed(2)}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-medium">
                      {path.labels.map((label, itemIndex) => (
                        <span key={label} className="contents">
                          <span className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
                            {label}
                          </span>
                          {itemIndex < path.labels.length - 1 && (
                            <span className="text-amber-600">→</span>
                          )}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4">
                      <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                        <span>Pheromone intensity</span>
                        <span>{path.pheromone.toFixed(2)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white">
                        <div
                          className="h-full bg-amber-500"
                          style={{ width: path.pheromone * 100 + '%' }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="border-slate-200 p-6 shadow-none">
              <h2 className="text-lg font-semibold">Ant colony parameters</h2>
              <div className="mt-5 space-y-4">
                {[
                  ['Ant count', '24'],
                  ['Pheromone importance α', '1.20'],
                  ['Heuristic importance β', '2.00'],
                  ['Evaporation rate ρ', '0.28'],
                  ['Maximum hops', '4'],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between border-b pb-3 text-sm"
                  >
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono font-semibold">{value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-lg bg-slate-50 p-3 font-mono text-[11px] leading-5 text-muted-foreground">
                P(i→j) ∝ τᵢⱼᵅ · ηᵢⱼᵝ
                <br />
                τᵢⱼ ← (1−ρ)τᵢⱼ + Δτᵢⱼ
              </div>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="gwo" className="mt-4">
          <section className="grid gap-5 xl:grid-cols-[1fr_390px]">
            <Card className="border-slate-200 p-6 shadow-none">
              <h2 className="text-lg font-semibold">GWO convergence</h2>
              <ConvergenceChart
                data={gwoRun?.convergence ?? []}
                color="#7c3aed"
              />
            </Card>
            <Card className="border-slate-200 p-6 shadow-none">
              <div className="flex items-center gap-2">
                <PawPrint className="size-5 text-violet-600" />
                <h2 className="text-lg font-semibold">Leadership hierarchy</h2>
              </div>
              <div className="mt-6 space-y-3">
                {[
                  ['Alpha', 'Best candidate subgraph', 0.904],
                  ['Beta', 'Second-best guide', 0.889],
                  ['Delta', 'Third guide', 0.876],
                  ['Omega', 'Exploring candidates', 0.742],
                ].map(([role, description, fitness], index) => (
                  <div key={String(role)} className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-full bg-violet-50 font-semibold text-violet-700">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{role}</p>
                      <p className="text-xs text-muted-foreground">
                        {description}
                      </p>
                    </div>
                    <span className="font-mono text-xs">
                      {Number(fitness).toFixed(3)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="woa" className="mt-4">
          <section className="grid gap-5 xl:grid-cols-[1fr_390px]">
            <Card className="border-slate-200 p-6 shadow-none">
              <h2 className="text-lg font-semibold">WOA convergence</h2>
              <ConvergenceChart
                data={woaRun?.convergence ?? []}
                color="#0284c7"
              />
            </Card>
            <Card className="border-slate-200 p-6 shadow-none">
              <div className="flex items-center gap-2">
                <Fish className="size-5 text-sky-600" />
                <h2 className="text-lg font-semibold">Search phases</h2>
              </div>
              <div className="mt-6 space-y-3">
                {[
                  [
                    '1',
                    'Searching',
                    'Explore distant pruning configurations.',
                    '46%',
                  ],
                  [
                    '2',
                    'Encircling',
                    'Move candidates toward the best solution.',
                    '31%',
                  ],
                  [
                    '3',
                    'Spiral exploitation',
                    'Refine the known strong configuration.',
                    '23%',
                  ],
                ].map(([step, title, detail, share]) => (
                  <div
                    key={step}
                    className="grid grid-cols-[38px_1fr_auto] items-center gap-3 rounded-lg border p-3"
                  >
                    <span className="grid size-9 place-items-center rounded-full bg-sky-50 font-mono text-sky-700">
                      {step}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{title}</p>
                      <p className="text-xs text-muted-foreground">{detail}</p>
                    </div>
                    <Badge variant="outline">{share}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="comparison" className="mt-4">
          <Card className="border-slate-200 p-6 shadow-none">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Comparative optimizer analysis
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use-case fit matters more than a single universal winner.
                </p>
              </div>
              <Badge variant="outline">SIMULATED DATA</Badge>
            </div>
            <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_420px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Algorithm</TableHead>
                    <TableHead>Best fitness</TableHead>
                    <TableHead>Iterations</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Best use case</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {swarmComparison.map((item) => (
                    <TableRow key={item.algorithm}>
                      <TableCell className="font-semibold">
                        {item.algorithm}
                      </TableCell>
                      <TableCell className="font-mono">
                        {item.bestFitness.toFixed(3)}
                      </TableCell>
                      <TableCell>{item.iterations}</TableCell>
                      <TableCell>{item.executionTime} ms</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.useCase}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Exploration capability
                </p>
                <ScoreBars
                  data={swarmComparison.map((item) => ({
                    name: item.algorithm,
                    value: item.exploration,
                  }))}
                  domain={[0, 100]}
                  color="#d97706"
                />
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <section className="grid gap-3 md:grid-cols-2">
        <Card className="border-cyan-200 bg-cyan-50 p-5 shadow-none">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-800">
            Exploration
          </p>
          <h2 className="mt-2 text-lg font-semibold">
            Discover alternative paths and parameter regions
          </h2>
          <p className="mt-2 text-sm text-cyan-900/70">
            High diversity reduces the risk of settling on a locally strong but
            globally weak graph configuration.
          </p>
        </Card>
        <Card className="border-indigo-200 bg-indigo-50 p-5 shadow-none">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-800">
            Exploitation
          </p>
          <h2 className="mt-2 text-lg font-semibold">
            Refine known strong paths and configurations
          </h2>
          <p className="mt-2 text-sm text-indigo-900/70">
            Focused updates improve convergence once the swarm identifies a
            promising region.
          </p>
        </Card>
      </section>

      <EducationPanel
        title="Swarm intelligence"
        items={{
          'What is this?':
            'Search behavior that emerges from many cooperating simple agents.',
          'Why is it being used?':
            'Graph paths and retrieval weights create large, irregular search spaces.',
          'How does it work?':
            'Agents update local state while sharing best positions or path memory.',
          'Where is it used in SoftGraph?':
            'Weight tuning, graph traversal, subgraph selection and pruning.',
          Inputs:
            'Candidate vectors or graph neighborhoods plus objective signals.',
          Outputs:
            'Best configuration, path or subgraph and a convergence trace.',
          Parameters:
            'Swarm size, inertia, coefficients, pheromone, evaporation and maximum hops.',
          Example: 'ACO explores paths; PSO tunes the weights that score them.',
        }}
      />
    </>
  );
}

export default function SwarmPage() { return serviceMode === 'api' ? <OptimizerWorkbench initialAlgorithm="PSO" /> : <SwarmDemo />; }
