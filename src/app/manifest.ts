import type { MetadataRoute } from 'next';

/**
 * Web app manifest — served at /manifest.webmanifest (Next file convention;
 * the <link rel="manifest"> is injected automatically).
 *
 * Kept public in middleware.ts / authConfig so the browser can fetch it
 * before login. theme_color / background_color mirror the LIGHT theme
 * tokens (--bg, --panel in src/styles/tokens.css) — a manifest cannot read
 * CSS variables, and every session starts in light mode by design.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'MYAS Task Tracker',
    short_name: 'MYAS Tasks',
    description:
      "Task and workflow management for the Joint Secretary's office, Ministry of Youth Affairs & Sports.",
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#f5f4f0',
    categories: ['productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
