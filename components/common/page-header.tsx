import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5 border-b pb-7 md:flex-row md:items-end md:justify-between">
      <div className="max-w-4xl">
        <div className="mb-3 flex items-center gap-2">
          {Icon && <Icon className="size-4 text-primary" />}
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
        </div>
        <h1 className="font-heading text-3xl font-semibold tracking-[-0.035em] md:text-4xl">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </section>
  );
}

export function DemoBadge({ children = 'SIMULATED / DEMONSTRATION DATA' }: { children?: React.ReactNode }) {
  return (
    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[10px] font-semibold tracking-wide text-amber-800">
      {children}
    </Badge>
  );
}
