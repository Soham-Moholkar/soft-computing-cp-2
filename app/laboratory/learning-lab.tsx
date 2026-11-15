'use client';

import { lazy, Suspense, useEffect, useState } from 'react';
import {
  Atom,
  Binary,
  BookOpen,
  BrainCircuit,
  ChartNoAxesCombined,
  Database,
  FileInput,
  FlaskConical,
  GitBranch,
  LoaderCircle,
  Network,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { SessionGate, useSession } from '@/components/auth/session-provider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { serviceMode } from '@/services';

const clientPanels = {
  syllabus: lazy(() => import('@/app/syllabus/page')),
  ingestion: lazy(() => import('@/app/ingestion/page')),
  graph: lazy(() => import('@/app/graph/page')),
  retrieval: lazy(() => import('@/app/retrieval/page')),
  fuzzy: lazy(() => import('@/app/fuzzy/page')),
  evolutionary: lazy(() => import('@/app/evolutionary/page')),
  swarm: lazy(() => import('@/app/swarm/page')),
  hybrid: lazy(() => import('@/app/hybrid/page')),
  explainability: lazy(() => import('@/app/explainability/page')),
};

const sections = [
  {
    id: 'syllabus',
    label: 'Syllabus',
    icon: BookOpen,
    live: false,
    description:
      'Explore every syllabus concept, how it works and where it appears in the system.',
  },
  {
    id: 'ingestion',
    label: 'Course sources',
    icon: FileInput,
    live: true,
    description: 'Import teaching sources into the separate course workspace.',
  },
  {
    id: 'graph',
    label: 'Course graph',
    icon: Network,
    live: true,
    description:
      'Inspect concepts, relations and evidence extracted from course sources.',
  },
  {
    id: 'retrieval',
    label: 'Course search',
    icon: Search,
    live: true,
    description:
      'Compare retrieval methods against the course workspace’s saved sources.',
  },
  {
    id: 'fuzzy',
    label: 'Fuzzy logic',
    icon: Binary,
    live: true,
    description:
      'Explore membership functions, inference rules and defuzzification.',
  },
  {
    id: 'evolutionary',
    label: 'Genetic algorithms',
    icon: GitBranch,
    live: true,
    description:
      'Configure genetic search and inspect the optimization process.',
  },
  {
    id: 'swarm',
    label: 'Swarm intelligence',
    icon: Atom,
    live: true,
    description:
      'Explore particle swarm and other population-based search methods.',
  },
  {
    id: 'hybrid',
    label: 'Hybrid systems',
    icon: BrainCircuit,
    live: true,
    description:
      'Experiment with combinations of fuzzy and optimization methods.',
  },
  {
    id: 'explainability',
    label: 'Explanations',
    icon: ShieldCheck,
    live: true,
    description:
      'Inspect evidence, score contributions and the decision trace for a saved course search.',
  },
  {
    id: 'benchmarks',
    label: 'Evaluation',
    icon: ChartNoAxesCombined,
    live: true,
    description: 'Inspect reproducible evaluation runs and comparison metrics.',
  },
  {
    id: 'architecture',
    label: 'Architecture',
    icon: Database,
    live: false,
    description:
      'Follow the system pipeline, service contracts and parameter registry.',
  },
  {
    id: 'applications',
    label: 'Use cases',
    icon: FlaskConical,
    live: false,
    description:
      'Connect course concepts to illustrative applications across domains.',
  },
] as const;

export function LearningLab({
  initialSection,
  architecture,
  applications,
  evaluation,
}: {
  initialSection: string;
  architecture: React.ReactNode;
  applications: React.ReactNode;
  evaluation: React.ReactNode;
}) {
  const [selectedId, setSelectedId] = useState(
    () =>
      sections.find((section) => section.id === initialSection)?.id ??
      'syllabus',
  );
  const selected =
    sections.find((section) => section.id === selectedId) ?? sections[0];
  const needsCourse = serviceMode === 'api' && selected.live;
  const { status, refresh } = useSession();

  useEffect(() => {
    let disposed = false;
    if (needsCourse && status === 'idle')
      void Promise.resolve().then(() => {
        if (!disposed) void refresh();
      });
    return () => {
      disposed = true;
    };
  }, [needsCourse, status, refresh]);

  const ActivePage = clientPanels[selected.id as keyof typeof clientPanels];
  const content =
    selected.id === 'architecture' ? (
      architecture
    ) : selected.id === 'applications' ? (
      applications
    ) : selected.id === 'benchmarks' ? (
      evaluation
    ) : ActivePage ? (
      <ActivePage />
    ) : null;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-white p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[.14em] text-teal-700">
          Your course companion
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Learning lab
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          The syllabus, explanations and experiments, together in one place.
          Start with a concept, try its controls, then inspect the evidence
          behind the result.
        </p>
        <p className="mt-3 max-w-3xl text-xs leading-6 text-slate-500">
          Course sources, graphs and searches use their own course workspace.
          Your other workspaces and hospital records stay separate.
        </p>
      </section>

      <Tabs
        value={selected.id}
        onValueChange={(value) => {
          const next = sections.find((section) => section.id === value);
          if (!next) return;
          setSelectedId(next.id);
          const url = new URL(window.location.href);
          url.searchParams.set('section', next.id);
          window.history.replaceState(null, '', url);
        }}
        className="gap-6"
      >
        <TabsList
          aria-label="Learning lab sections"
          className="h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0 group-data-horizontal/tabs:h-auto"
        >
          {sections.map(({ id, label, icon: Icon }) => (
            <TabsTrigger
              key={id}
              value={id}
              className="h-10 flex-none rounded-lg border bg-white px-3 text-xs data-active:border-teal-600 data-active:bg-teal-50 data-active:text-teal-900"
            >
              <Icon className="size-3.5" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent
          key={selected.id}
          value={selected.id}
          className="space-y-6"
        >
          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-sm font-semibold">{selected.label}</p>
            <p className="mt-1 text-xs leading-6 text-slate-600">
              {selected.description}
            </p>
            {selected.live ? (
              <p className="mt-2 text-[11px] font-medium text-teal-700">
                {serviceMode === 'api'
                  ? 'Course workspace · local API'
                  : 'Simulated teaching demonstration'}
              </p>
            ) : null}
          </div>
          <SessionGate required={needsCourse} course={needsCourse}>
            <Suspense
              fallback={
                <output className="flex min-h-48 items-center justify-center gap-3 text-sm text-slate-500">
                  <LoaderCircle className="size-5 animate-spin" />
                  Loading {selected.label.toLowerCase()}…
                </output>
              }
            >
              {content}
            </Suspense>
          </SessionGate>
        </TabsContent>
      </Tabs>
    </div>
  );
}
