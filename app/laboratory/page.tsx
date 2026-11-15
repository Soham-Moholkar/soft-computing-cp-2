import { Suspense } from 'react';
import ArchitecturePage from '@/app/architecture/page';
import ApplicationsPage from '@/app/applications/page';
import BenchmarksPage from '@/app/benchmarks/page';
import { LearningLab } from './learning-lab';

export default async function LaboratoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parameters = await searchParams;
  const section =
    typeof parameters.section === 'string' ? parameters.section : 'syllabus';
  return (
    <LearningLab
      initialSection={section}
      architecture={<ArchitecturePage />}
      applications={<ApplicationsPage />}
      evaluation={
        <Suspense fallback={<output>Loading evaluation…</output>}>
          <BenchmarksPage />
        </Suspense>
      }
    />
  );
}
