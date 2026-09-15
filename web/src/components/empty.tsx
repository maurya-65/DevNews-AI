export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-muted/25 px-8 py-20 text-center ring-1 ring-foreground/[0.06]">
      <p className="font-heading text-lg font-medium tracking-[-0.02em]">{title}</p>
      {hint && (
        <p className="mx-auto mt-2.5 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
