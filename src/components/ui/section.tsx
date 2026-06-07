export function Section({
  action,
  children,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-black uppercase tracking-wide text-stone-950">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
