import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/nav";
import { currentUser } from "@/lib/auth";
import { ThemeProvider } from "@/components/theme";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// shadcn's theme maps --font-sans / --font-mono; without a real face behind them the
// browser falls back to its default serif.
const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DevNews",
  description: "A personal CS briefing, chosen daily.",
};

// Debug is a tuning tool, not a reader page: it exposes rejected items, raw scores and
// token counts. Off unless SHOW_DEBUG is set, and never in the nav otherwise.
const SHOW_DEBUG = process.env.SHOW_DEBUG === "1";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable}`}
    >
      <body className="min-h-svh bg-background font-sans text-foreground antialiased">
        <ThemeProvider>
          <TooltipProvider delay={200}>
            <Nav showDebug={SHOW_DEBUG} signedIn={Boolean(user)} />
            <main className="mx-auto max-w-3xl px-6 pb-24 pt-12">{children}</main>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
