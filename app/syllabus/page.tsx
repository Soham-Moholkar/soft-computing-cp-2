'use client';

import { useMemo, useState } from 'react';
import { BookCheck, CheckCircle2, Search } from 'lucide-react';
import type { SyllabusEntry } from '@/lib/types';
import { syllabusEntries } from '@/data/syllabus';
import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const filters = ['All', 'Unit I', 'Unit II', 'Unit III', 'Unit IV', 'Unit V', 'Unit VI', 'Fuzzy Logic', 'Genetic Algorithms', 'Swarm Intelligence', 'Hybrid Systems', 'Knowledge Graph Construction', 'Retrieval', 'Optimization', 'Explainability'];

function matchesFilter(entry: SyllabusEntry, filter: string): boolean {
  if (filter === 'All') return true;
  if (filter.startsWith('Unit ')) return entry.unit === filter;
  if (['Fuzzy Logic', 'Genetic Algorithms', 'Swarm Intelligence', 'Hybrid Systems'].includes(filter)) return entry.category === filter;
  const text = (entry.whereUsed + ' ' + entry.whyUsed + ' ' + entry.frontendDemo + ' ' + entry.futureBackend + ' ' + entry.concept).toLowerCase();
  if (filter === 'Knowledge Graph Construction') return /(graph|entity|relation|extraction|construction)/.test(text);
  return text.includes(filter.toLowerCase());
}

export default function SyllabusPage() {
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<SyllabusEntry>(syllabusEntries[0]);
  const filtered = useMemo(() => syllabusEntries.filter((entry) => {
    const searchable = Object.values(entry).join(' ').toLowerCase();
    return matchesFilter(entry, filter) && (!query.trim() || searchable.includes(query.toLowerCase()));
  }), [filter, query]);

  return (
    <>
      <PageHeader
        eyebrow="Complete course validation"
        title="Syllabus → system integration registry"
        description="Every concept is linked to a product use, input, output, parameter, equation, frontend demonstration, future Python module and evaluation metric."
        icon={BookCheck}
        actions={<Badge className="h-7 bg-emerald-600 px-3"><CheckCircle2 /> {syllabusEntries.length} concepts represented</Badge>}
      />

      <Card className="border-slate-200 p-5 shadow-none">
        <div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-9 pl-9" placeholder="Search concept, equation, page, backend module or metric…" /></div>
        <div className="mt-4 flex flex-wrap gap-2">
          {filters.map((item) => <Button key={item} size="sm" variant={filter === item ? 'default' : 'outline'} onClick={() => setFilter(item)}>{item}</Button>)}
        </div>
        <div className="mt-4 flex items-center justify-between border-t pt-4 text-xs text-muted-foreground"><span>Showing {filtered.length} of {syllabusEntries.length} registry entries</span><span>Click a row to inspect complete mapping</span></div>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="border-slate-200 p-4 shadow-none">
          <Table>
            <TableHeader><TableRow><TableHead>Coverage</TableHead><TableHead>Unit</TableHead><TableHead>Concept</TableHead><TableHead>Category</TableHead><TableHead>Where used</TableHead><TableHead>Metric</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((entry) => (
                <TableRow key={entry.unit + entry.concept} onClick={() => setSelected(entry)} className={selected === entry ? 'cursor-pointer bg-primary/5' : 'cursor-pointer'}>
                  <TableCell><CheckCircle2 className="size-4 text-emerald-600" /></TableCell>
                  <TableCell><Badge variant="outline">{entry.unit}</Badge></TableCell>
                  <TableCell className="font-medium">{entry.concept}</TableCell>
                  <TableCell><Badge variant="secondary">{entry.category}</Badge></TableCell>
                  <TableCell className="max-w-52 truncate text-xs text-muted-foreground">{entry.whereUsed}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{entry.evaluationMetric}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No syllabus concepts match this filter.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>

        <Card className="h-fit border-slate-200 p-6 shadow-none xl:sticky xl:top-28">
          <div className="flex flex-wrap items-center gap-2"><Badge>{selected.unit}</Badge><Badge variant="outline">{selected.category}</Badge></div>
          <h2 className="mt-4 text-xl font-semibold">{selected.concept}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{selected.whyUsed}</p>
          <dl className="mt-6 space-y-4">
            {[
              ['Topic', selected.topic],
              ['Where used', selected.whereUsed],
              ['Input', selected.input],
              ['Output', selected.output],
              ['Parameters', selected.parameters],
              ['Equation / rule', selected.equation],
              ['Frontend demonstration', selected.frontendDemo],
              ['Future backend', selected.futureBackend],
              ['Evaluation metric', selected.evaluationMetric],
            ].map(([label, value]) => <div key={label} className="border-b pb-3"><dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">{label}</dt><dd className="mt-1 text-sm leading-6 text-slate-700">{value}</dd></div>)}
          </dl>
        </Card>
      </section>
    </>
  );
}
