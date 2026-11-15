'use client';
import { OptimizerWorkbench } from '@/components/optimization/optimizer-workbench';
import { serviceMode } from '@/services';

import { useEffect, useState } from 'react';
import { CheckCircle2, Dna, GitBranch, RefreshCw } from 'lucide-react';
import type { OptimizerRun } from '@/lib/types';
import { crossover, mutateChromosome } from '@/lib/algorithms/genetic';
import { services } from '@/services';
import { ConvergenceChart } from '@/components/charts/convergence-chart';
import { EducationPanel } from '@/components/common/education-panel';
import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Slider } from '@/components/ui/slider';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const geneNames = [
  'entity τ',
  'relation τ',
  'semantic w',
  'graph w',
  'confidence w',
  'source w',
  'hop penalty',
  'centrality w',
];
const parentA = [0.68, 0.61, 0.29, 0.18, 0.2, 0.11, 0.08, 0.1];
const parentB = [0.73, 0.59, 0.24, 0.22, 0.17, 0.13, 0.06, 0.12];

function EvolutionaryDemo() {
  const [populationSize, setPopulationSize] = useState(36);
  const [generations, setGenerations] = useState(45);
  const [mutationRate, setMutationRate] = useState(0.08);
  const [crossoverRate, setCrossoverRate] = useState(0.82);
  const [selection, setSelection] = useState<'roulette' | 'tournament'>(
    'tournament',
  );
  const [encoding, setEncoding] = useState<'binary' | 'real'>('real');
  const [run, setRun] = useState<OptimizerRun | null>(null);
  const [seed, setSeed] = useState(17);

  useEffect(() => {
    void services.evolutionary
      .optimize({
        populationSize,
        iterations: generations,
        mutationRate,
        crossoverRate,
        selection,
        encoding,
      })
      .then(setRun);
  }, [
    populationSize,
    generations,
    mutationRate,
    crossoverRate,
    selection,
    encoding,
    seed,
  ]);

  const [childA, childB] = crossover(parentA, parentB, 4);
  const mutated = mutateChromosome(childA, mutationRate, seed);
  const pareto = [
    { accuracy: 73, latency: 42 },
    { accuracy: 77, latency: 48 },
    { accuracy: 81, latency: 54 },
    { accuracy: 84, latency: 66 },
    { accuracy: 87, latency: 81 },
    { accuracy: 89, latency: 103 },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Unit III · Evolutionary computing"
        title="Genetic algorithm laboratory"
        description="Evolve a real-valued chromosome that controls extraction thresholds and retrieval weights. Every change produces the same repeatable population trajectory for classroom use."
        icon={Dna}
        actions={
          <Button
            variant="outline"
            onClick={() => setSeed((value) => value + 3)}
          >
            <RefreshCw /> Re-run deterministic evolution
          </Button>
        }
      />

      <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <Card className="border-slate-200 p-6 shadow-none">
          <h2 className="text-lg font-semibold">Evolution controls</h2>
          <div className="mt-5 space-y-6">
            {[
              ['Population size', populationSize, setPopulationSize, 8, 100, 1],
              ['Generations', generations, setGenerations, 10, 100, 1],
              ['Mutation rate', mutationRate, setMutationRate, 0, 0.3, 0.01],
              ['Crossover rate', crossoverRate, setCrossoverRate, 0.2, 1, 0.01],
            ].map(([label, value, setter, min, max, step]) => (
              <div key={String(label)}>
                <div className="mb-2 flex justify-between text-xs">
                  <span>{String(label)}</span>
                  <span className="font-mono">
                    {Number(value) < 1
                      ? Number(value).toFixed(2)
                      : String(value)}
                  </span>
                </div>
                <Slider
                  value={[Number(value)]}
                  min={Number(min)}
                  max={Number(max)}
                  step={Number(step)}
                  onValueChange={(next) =>
                    (setter as (value: number) => void)(
                      Array.isArray(next) ? next[0] : next,
                    )
                  }
                />
              </div>
            ))}
            <label
              htmlFor="ga-selection"
              className="space-y-2 text-xs font-medium"
            >
              Selection
              <NativeSelect
                id="ga-selection"
                className="w-full"
                value={selection}
                onChange={(event) =>
                  setSelection(event.target.value as typeof selection)
                }
              >
                <NativeSelectOption value="tournament">
                  Tournament selection
                </NativeSelectOption>
                <NativeSelectOption value="roulette">
                  Roulette wheel
                </NativeSelectOption>
              </NativeSelect>
            </label>
            <label
              htmlFor="ga-encoding"
              className="space-y-2 text-xs font-medium"
            >
              Encoding
              <NativeSelect
                id="ga-encoding"
                className="w-full"
                value={encoding}
                onChange={(event) =>
                  setEncoding(event.target.value as typeof encoding)
                }
              >
                <NativeSelectOption value="real">
                  Real-valued
                </NativeSelectOption>
                <NativeSelectOption value="binary">
                  Binary demonstration
                </NativeSelectOption>
              </NativeSelect>
            </label>
            <label
              htmlFor="ga-objective"
              className="space-y-2 text-xs font-medium"
            >
              Fitness objective
              <NativeSelect
                id="ga-objective"
                className="w-full"
                defaultValue="balanced"
              >
                <NativeSelectOption value="balanced">
                  Balanced quality
                </NativeSelectOption>
                <NativeSelectOption value="accuracy">
                  Retrieval accuracy
                </NativeSelectOption>
                <NativeSelectOption value="coherence">
                  Graph coherence
                </NativeSelectOption>
                <NativeSelectOption value="latency">
                  Low latency
                </NativeSelectOption>
              </NativeSelect>
            </label>
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="border-slate-200 p-6 shadow-none">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Generation vs best fitness
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Precision, recall, NDCG and coherence minus latency, noise and
                  density penalties
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-2xl font-semibold text-primary">
                  {run?.bestFitness.toFixed(3) ?? '—'}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  best fitness
                </p>
              </div>
            </div>
            <ConvergenceChart data={run?.convergence ?? []} />
            <div className="rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-600">
              fitness = 0.22·P@K + 0.18·R@K + 0.18·NDCG + 0.14·MRR +
              0.14·coherence − 0.08·latency − 0.06·noise
            </div>
          </Card>

          <Card className="border-slate-200 p-6 shadow-none">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Best chromosome</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Eight backend-ready genes
                </p>
              </div>
              <Badge variant="outline">{encoding} encoding</Badge>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4">
              {(run?.bestVector ?? parentA).map((gene, index) => (
                <div
                  key={geneNames[index]}
                  className="rounded-lg border bg-slate-50 p-3"
                >
                  <p className="text-[10px] text-muted-foreground">
                    {geneNames[index]}
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold">
                    {encoding === 'binary'
                      ? Math.round(gene * 255)
                          .toString(2)
                          .padStart(8, '0')
                      : gene.toFixed(3)}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-emerald-700">
              <CheckCircle2 className="size-4" /> Constraints valid: every gene
              ∈ [0,1]; retrieval weights normalized during evaluation.
            </div>
          </Card>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card className="border-slate-200 p-6 shadow-none">
          <div className="flex items-center gap-2">
            <GitBranch className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">
              Selection → crossover → mutation
            </h2>
          </div>
          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>Chromosome</TableHead>
                <TableHead>Genes</TableHead>
                <TableHead>Fitness</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                [
                  'Parent A',
                  parentA,
                  0.842,
                  selection === 'tournament' ? 'Tournament winner' : 'p = 0.24',
                ],
                [
                  'Parent B',
                  parentB,
                  0.829,
                  selection === 'tournament'
                    ? 'Tournament runner-up'
                    : 'p = 0.21',
                ],
                ['Child A', childA, 0.861, 'Single-point crossover @ 4'],
                ['Child B', childB, 0.836, 'Single-point crossover @ 4'],
                [
                  'Mutated child',
                  mutated,
                  0.874,
                  'Mutation p = ' + mutationRate.toFixed(2),
                ],
              ].map(([name, genes, fitness, status]) => (
                <TableRow key={String(name)}>
                  <TableCell className="font-medium">{String(name)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {(genes as number[]).map((gene, index) => (
                        <span
                          key={index}
                          className={
                            name === 'Mutated child' && gene !== childA[index]
                              ? 'rounded bg-amber-100 px-1.5 py-1 font-mono text-[10px] text-amber-900'
                              : 'rounded bg-slate-100 px-1.5 py-1 font-mono text-[10px]'
                          }
                        >
                          {gene.toFixed(2)}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">
                    {Number(fitness).toFixed(3)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {String(status)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card className="border-slate-200 p-6 shadow-none">
          <h2 className="text-lg font-semibold">Conceptual Pareto front</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Accuracy improves at a latency cost.
          </p>
          <div className="relative mt-5 h-64 rounded-lg border bg-slate-50">
            <span className="absolute bottom-2 left-3 text-[10px] text-muted-foreground">
              Lower latency
            </span>
            <span className="absolute right-2 top-3 rotate-90 text-[10px] text-muted-foreground">
              Higher accuracy
            </span>
            {pareto.map((point, index) => (
              <span
                key={point.accuracy}
                className="absolute grid size-7 -translate-x-1/2 translate-y-1/2 place-items-center rounded-full border-2 border-white bg-primary text-[9px] text-white shadow"
                style={{
                  left: (point.latency - 30) / 0.9 + '%',
                  bottom: (point.accuracy - 65) * 3.4 + '%',
                }}
              >
                {index + 1}
              </span>
            ))}
          </div>
        </Card>
      </section>

      <EducationPanel
        title="Genetic optimization"
        items={{
          'What is this?':
            'A population-based search over pipeline configurations.',
          'Why is it being used?':
            'Thresholds and ranking weights interact nonlinearly and have competing objectives.',
          'How does it work?':
            'Select parents, recombine genes, mutate values and preserve strong candidates.',
          'Where is it used in SoftGraph?':
            'Membership tuning, extraction thresholds, pruning and ranking weights.',
          Inputs:
            'Population, generations, encoding, rates and fitness weights.',
          Outputs:
            'Best chromosome, convergence trace and Pareto alternatives.',
          Parameters:
            'Population 8–200, mutation 0–0.5, crossover 0–1 and elitism.',
          Example:
            'GA evolves semantic and graph weights before PSO refines them.',
        }}
      />
    </>
  );
}

export default function EvolutionaryPage() { return serviceMode === 'api' ? <OptimizerWorkbench initialAlgorithm="GA" /> : <EvolutionaryDemo />; }
