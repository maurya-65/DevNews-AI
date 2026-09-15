import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { Shell } from "@/components/shell";
import { getViewer } from "@/lib/viewer";
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
  title: { default: "DevNews", template: "%s · DevNews" },
  description: "The few computer-science stories worth your time today, chosen for you.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const viewer = await getViewer();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} ${display.variable}`}
    >
      <body className="min-h-svh bg-background font-sans text-foreground antialiased">
        <ThemeProvider>
          <TooltipProvider delay={200}>
            <Shell identity={viewer?.identity ?? null}>
              {children}
            </Shell>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
