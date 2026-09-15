/** Formatting shared by server and client components. No server imports here. */

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Edition dates are UTC calendar dates ("2026-09-15"); render them as that date, not shifted. */
export function formatEditionDate(date: string, style: "long" | "short" = "long") {
  const d = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: style === "long" ? "long" : undefined,
    day: "numeric",
    month: style === "long" ? "long" : "short",
    year: style === "short" ? "numeric" : undefined,
  });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

/** "3h ago", "2d ago". Coarse on purpose: this is a daily product. */
export function ago(iso: string, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function readingMinutes(wordCount: number | null) {
  if (!wordCount || wordCount < 120) return null;
  return Math.max(1, Math.round(wordCount / 230));
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function monthOf(date: string) {
  return new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}
