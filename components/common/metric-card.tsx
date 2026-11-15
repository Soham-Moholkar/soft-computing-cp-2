import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';

export function MetricCard({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string;
  value: string;
  note: string;
  icon?: LucideIcon;
}) {
  return (
    <Card className="gap-2 border-slate-200 p-5 shadow-none">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon && <Icon className="size-4 text-primary" />}
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="font-mono text-2xl font-semibold tracking-tight">{value}</p>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">{note}</span>
      </div>
    </Card>
  );
}
