"use client";

import { useState, useTransition } from "react";
import { muteTopic } from "@/app/actions";

export function MuteTopic({ topic, label }: { topic: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending || message !== null}
        onClick={() =>
          startTransition(async () => {
            const result = await muteTopic(topic);
            setMessage(result.message);
          })
        }
        className="font-mono text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:no-underline disabled:opacity-60"
      >
        {pending ? "Muting…" : `Never show ${label}`}
      </button>
      {message && <span className="font-mono text-[11px] text-signal">{message}</span>}
    </span>
  );
}
