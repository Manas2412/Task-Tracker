import type { Metadata, Viewport } from 'next';
import { Manrope, Newsreader, JetBrains_Mono } from 'next/font/google';

import { cn } from '@/lib/utils';

import './globals.css';

/**
 * The three-font system.
 * Loaded once at the root layout; CSS variables are wired to Tailwind in
 * tailwind.config.ts via `fontFamily.{sans,serif,mono}`.
 *
 * Weights:
 *   - Manrope: 400, 500 only (no mid-sentence bolding).
 *   - Newsreader: 400, 500 — headings, formal quotes.
 *   - JetBrains Mono: 400, 500 — usernames, TF reference numbers.
 */

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-manrope',
  display: 'swap',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-newsreader',
  display: 'swap',
  // Next can't auto-compute fallback metrics for Newsreader's variable axes.
  // We pin our own fallback in globals.css, so disable Next's auto-adjust.
  adjustFontFallback: false,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Tasks · MYAS',
  description:
    'Task and workflow management for the Joint Secretary\'s office, Ministry of Youth Affairs & Sports.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#f5f4f0',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(manrope.variable, newsreader.variable, jetbrainsMono.variable)}>
      <body>{children}</body>
    </html>
  );
}
