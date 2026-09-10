import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { Nav } from "@/components/nav";
import { currentUser } from "@/lib/auth";
import { initialsFrom, nameFrom, type Identity } from "@/lib/identity";
import { ThemeProvider } from "@/components/theme";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

/** Three faces, one job each.
 *
 *  Geist was the old pairing and it is a fine typeface, but it is also the default of
 *  every scaffolded project, so it reads as "not chosen". These were: Bricolage has real
 *  quirks in its bowls and terminals at display sizes, Instrument Sans stays quiet under
 *  it at reading sizes, and JetBrains Mono carries every piece of metadata. The rule that
 *  keeps it coherent is dumb on purpose — big is display, small is mono, prose is sans.
 */
const display = Bricolage_Grotesque({
  variable: "--font-display-face",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});
const sans = Instrument_Sans({ variable: "--font-sans", subsets: ["latin"] });
const mono = JetBrains_Mono({
  variable: "--font-mono-face",
  subsets: ["latin"],
  weight: ["400", "500"],
});

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
  const name = nameFrom(user?.user_metadata);
  const identity: Identity | null = user
    ? {
        name,
        email: user.email ?? null,
        initials: initialsFrom(name, user.email),
        providers: (user.app_metadata?.providers as string[] | undefined) ?? [],
      }
    : null;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} ${display.variable}`}
    >
      <body className="min-h-svh bg-background font-sans text-foreground antialiased">
        <ThemeProvider>
          <TooltipProvider delay={200}>
            <Nav showDebug={SHOW_DEBUG} identity={identity} />
            <main className="mx-auto max-w-3xl px-6 pb-28 pt-14">{children}</main>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
