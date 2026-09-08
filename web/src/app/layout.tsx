import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevNews",
  description: "A personal CS briefing, chosen daily.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-stone-50 text-stone-900 antialiased dark:bg-stone-950 dark:text-stone-100">
        <div className="mx-auto max-w-2xl px-5 py-10">
          <header className="mb-10 flex items-baseline justify-between border-b border-stone-200 pb-4 dark:border-stone-800">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              DevNews
            </Link>
            <nav className="flex gap-4 text-sm text-stone-500 dark:text-stone-400">
              <Link href="/" className="hover:text-stone-900 dark:hover:text-stone-100">
                Digest
              </Link>
              <Link href="/debug" className="hover:text-stone-900 dark:hover:text-stone-100">
                Debug
              </Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
