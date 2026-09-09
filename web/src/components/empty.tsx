export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 px-8 py-20 text-center">
      <p className="text-base font-medium">{title}</p>
      {hint && (
        <p className="mx-auto mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
