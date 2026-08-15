import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

/*
 * Two families, both self-hosted by next/font — no external font requests.
 *
 * Switzer carries everything readable: a neutral grotesque with slightly
 * humanist terminals. Structured enough to carry a score report, warm enough
 * not to feel clinical.
 *
 * Geist Mono carries anything that ticks or gets compared — timers, scores,
 * rates — in tabular numerals so digits never shift width mid-count.
 */
const switzer = localFont({
  src: "./fonts/Switzer-Variable.woff2",
  variable: "--font-switzer",
  weight: "100 900",
  display: "swap",
  fallback: ["SF Pro Text", "system-ui", "sans-serif"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "On Air — practice speaking with a real person",
  description:
    "Get matched with someone practicing the same language, talk about a topic you didn't pick, and find out exactly how you sounded.",
};

export const viewport: Viewport = {
  themeColor: "#1C1611",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${switzer.variable} ${geistMono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
