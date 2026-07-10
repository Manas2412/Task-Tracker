import type { Metadata, Viewport } from 'next';
import { Manrope, Newsreader, JetBrains_Mono } from 'next/font/google';
import Script from 'next/script';

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
  viewportFit: 'cover',
  // Light default; the init script and the toggle rewrite this meta's content
  // to match the *active* app theme (so the mobile URL-bar tint follows the
  // in-app toggle, not just the OS scheme).
  themeColor: '#f5f4f0',
};

// Runs before first paint: resolves the saved theme (or the OS preference on a
// first visit) and applies it to <html> so there is no light flash in dark.
// The localStorage read is isolated in its own try so that, if storage access
// throws, the OS-preference fallback and the attribute writes still run.
const THEME_INIT = `(function(){var d=document.documentElement,t;try{t=localStorage.getItem('theme')}catch(e){}if(t!=='light'&&t!=='dark'){try{t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(e){t='light'}}d.setAttribute('data-theme',t);d.style.colorScheme=t;try{var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t==='dark'?'#0e0e11':'#f5f4f0')}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(manrope.variable, newsreader.variable, jetbrainsMono.variable)}
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        {children}
      </body>
      {process.env.NEXT_PUBLIC_GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];
              function gtag(){dataLayer.push(arguments);}
              gtag('js',new Date());
              gtag('config','${process.env.NEXT_PUBLIC_GA_ID}');`}
          </Script>
        </>
      )}
    </html>
  );
}
