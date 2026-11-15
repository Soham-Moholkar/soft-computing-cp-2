const labels = ['What is this?', 'Why is it being used?', 'How does it work?', 'Where is it used in SoftGraph?', 'Inputs', 'Outputs', 'Parameters', 'Example'];

export function EducationPanel({
  title,
  items,
}: {
  title: string;
  items: Partial<Record<(typeof labels)[number], React.ReactNode>>;
}) {
  return (
    <details className="group rounded-xl border bg-card">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold outline-none marker:hidden">
        <span className="flex items-center justify-between">
          Educational mode · {title}
          <span className="text-xs font-normal text-muted-foreground group-open:hidden">Expand</span>
          <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">Collapse</span>
        </span>
      </summary>
      <div className="grid gap-4 border-t px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
        {labels.map((label) => items[label] && (
          <div key={label}>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">{label}</p>
            <div className="mt-1 text-sm leading-6 text-muted-foreground">{items[label]}</div>
          </div>
        ))}
      </div>
    </details>
  );
}
