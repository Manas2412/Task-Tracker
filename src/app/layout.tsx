import type { Metadata, Viewport } from 'next';
import { Manrope, Newsreader, JetBrains_Mono } from 'next/font/google';
import Script from 'next/script';

import { PwaInstallPrompt } from '@/components/pwa/PwaInstallPrompt';
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

/**
 * iOS home-screen splash screens (apple-touch-startup-image). iOS shows a
 * blank white flash without these; each entry must match a device's exact
 * point size + pixel ratio or Safari ignores it. Generated from the brand
 * logo — see docs/PWA.md for the covered devices and regeneration steps.
 */
const APPLE_SPLASH = [
  { w: 750, h: 1334, dw: 375, dh: 667, r: 2 },
  { w: 1125, h: 2436, dw: 375, dh: 812, r: 3 },
  { w: 828, h: 1792, dw: 414, dh: 896, r: 2 },
  { w: 1242, h: 2688, dw: 414, dh: 896, r: 3 },
  { w: 1242, h: 2208, dw: 414, dh: 736, r: 3 },
  { w: 1170, h: 2532, dw: 390, dh: 844, r: 3 },
  { w: 1179, h: 2556, dw: 393, dh: 852, r: 3 },
  { w: 1206, h: 2622, dw: 402, dh: 874, r: 3 },
  { w: 1284, h: 2778, dw: 428, dh: 926, r: 3 },
  { w: 1290, h: 2796, dw: 430, dh: 932, r: 3 },
  { w: 1320, h: 2868, dw: 440, dh: 956, r: 3 },
].map(({ w, h, dw, dh, r }) => ({
  url: `/splash/apple-splash-${w}-${h}.png`,
  media: `(device-width: ${dw}px) and (device-height: ${dh}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
}));

export const metadata: Metadata = {
  title: 'Tasks · MYAS',
  applicationName: 'MYAS Task Tracker',
  description:
    'Task and workflow management for the Joint Secretary\'s office, Ministry of Youth Affairs & Sports.',
  // PWA imagery lives in /public/icons (public in middleware.ts) — iOS
  // fetches these unauthenticated when adding to the home screen. The
  // manifest itself is the src/app/manifest.ts file convention.
  icons: {
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'MYAS Tasks',
    statusBarStyle: 'default',
    startupImage: APPLE_SPLASH,
  },
  other: {
    // Chromium pendant of apple-mobile-web-app-capable; silences the
    // DevTools deprecation notice when only the Apple meta is present.
    'mobile-web-app-capable': 'yes',
  },
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

// Runs before first paint. The default is ALWAYS light — dark applies only when
// the user has explicitly toggled it this session (stored as theme='dark'). We
// deliberately do NOT fall back to the OS `prefers-color-scheme`, so every login
// starts in light mode (the auth layout clears the stored preference on the way
// in). Isolated try around the storage read keeps the attribute writes running
// even if storage access throws.
const THEME_INIT = `(function(){var d=document.documentElement,t;try{t=localStorage.getItem('theme')}catch(e){}if(t!=='dark')t='light';d.setAttribute('data-theme',t);d.style.colorScheme=t;try{var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t==='dark'?'#0e0e11':'#f5f4f0')}catch(e){}})();`;

// Chrome can fire beforeinstallprompt before React hydrates. On phones (same
// gate as the install card) stash it — suppressing the mini-infobar — for
// PwaInstallPrompt to consume on mount. Desktop is left untouched.
const PWA_BIP_CAPTURE = `window.addEventListener('beforeinstallprompt',function(e){try{if(matchMedia('(max-width: 767px)').matches&&matchMedia('(pointer: coarse)').matches){e.preventDefault();window.__myasPwaBip=e}}catch(err){}});`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(manrope.variable, newsreader.variable, jetbrainsMono.variable)}
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <script dangerouslySetInnerHTML={{ __html: PWA_BIP_CAPTURE }} />
        {children}
        <PwaInstallPrompt />
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
