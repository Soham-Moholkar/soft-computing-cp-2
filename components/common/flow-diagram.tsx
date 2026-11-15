import { ArrowRight } from 'lucide-react';

export function FlowDiagram({ steps, compact = false }: { steps: Array<{ title: string; detail?: string }>; compact?: boolean }) {
  return (
    <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
      {steps.map((step, index) => (
        <div key={step.title} className="flex shrink-0 items-center gap-2">
          <div className={compact ? 'w-40 rounded-lg border bg-card p-3' : 'w-48 rounded-xl border bg-card p-4'}>
            <p className="text-xs font-semibold">{step.title}</p>
            {step.detail && <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{step.detail}</p>}
          </div>
          {index < steps.length - 1 && <ArrowRight className="size-4 shrink-0 text-slate-300" />}
        </div>
      ))}
    </div>
  );
}
