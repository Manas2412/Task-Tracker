# Progressive Web App

The tracker installs to the home screen on Android (Chrome) and iPhone (Safari)
and launches standalone with the MYAS "Task · Dept of Sports" branding. Desktop
browsers are deliberately not prompted. This is **not** offline mode (still out
of scope per PRD §10) — the service worker only guarantees a branded fallback
page when the network is gone.

## Pieces

| Piece | Path | Notes |
|---|---|---|
| Manifest | `src/app/manifest.ts` | Next file convention → served at `/manifest.webmanifest`, `<link>` auto-injected |
| Service worker | `public/sw.js` | Plain JS, registered by `PwaInstallPrompt` in production builds only |
| Offline fallback | `public/offline.html` | Precached; shown when a navigation fails offline |
| Install prompt card | `src/components/pwa/PwaInstallPrompt.tsx` | Mounted once in `src/app/layout.tsx` |
| Icons | `public/icons/` | 192/512 standard + maskable, 180 apple-touch-icon |
| iOS splash screens | `public/splash/` | 11 portrait sizes (SE → 16 Pro Max), linked via `appleWebApp.startupImage` in the root layout |
| Favicon | `src/app/favicon.ico` | Next file convention (16/32/48 multi-size) |

## Install prompt behaviour

- **Phones only** — same gate as `useTaskCardGestures`: `(max-width: 767px)`
  **and** `(pointer: coarse)`. Desktop and tablets never see the card (Chrome
  desktop still offers its own omnibox install icon; that is browser chrome we
  do not control).
- **Android / Chromium**: captures `beforeinstallprompt` (suppressing Chrome's
  mini-infobar) and shows a card with a one-tap Install button.
- **iPhone Safari**: no install API exists, so after a 2 s settle delay the
  card shows "Share → Add to Home Screen" instructions.
- **Never shown** when running standalone, after `appinstalled`, or after an
  accepted native prompt (`pwa-installed` in localStorage). iOS cannot report
  "already installed" to the browser tab, so the localStorage flag plus the
  standalone check is the best signal available.
- **Dismissal**: the ✕ button, a declined native prompt, or the 10 s
  auto-dismiss all set `pwa-install-dismissed` in sessionStorage — the card
  stays away for the rest of that browsing session. Interacting with the card
  cancels the auto-dismiss timer.

## Caching strategy (sw.js)

- Navigations: network only; offline → `offline.html`. Nothing personalised is
  ever cached.
- `/_next/static/*`, `/icons/*`, `/splash/*`: cache-first (all immutable),
  capped at 150 entries (oldest evicted first, precache never evicted) so
  hashed chunks from old deploys cannot accumulate forever.
- Everything else (API routes, server actions): untouched.
- **Bump `VERSION` in `sw.js`** when changing the precache list or strategy —
  activation deletes older caches. `sw.js` itself is served
  `no-cache` (see `next.config.mjs`), so clients pick up new workers promptly.

## Auth exclusions

The middleware matcher (`middleware.ts`) and `authorized()` callback
(`src/lib/auth/config.ts`) both exempt `/manifest.webmanifest`, `/sw.js`,
`/offline.html`, `/icons/*` and `/splash/*` — browsers fetch these without a
session while installing or launching the app. Keep the two lists in sync.

## Regenerating the imagery

Icons and splash screens are generated from the master logo (do not edit the
PNGs by hand). With `sharp` + `png-to-ico` in a scratch folder:

- trim the logo's white margin, then render it centred on a white canvas —
  92% of the tile for standard icons, 68% for maskable (80% safe zone),
  84% for the 180 px apple-touch-icon, 38% of the short edge for splashes;
- favicon.ico = 16/32/48 via `png-to-ico`.

`/icons/*` and `/splash/*` ship with `immutable` cache headers — if the
artwork ever changes, rename the files (and update `manifest.ts`,
`layout.tsx`, `sw.js`, this doc) rather than replacing them in place.

## Verifying locally

The service worker registers in production builds only (`pnpm build && pnpm
start`); in dev the component actively unregisters any worker left over from
a local production run, so `pnpm dev` on the same origin self-heals after a
reload. Check DevTools → Application: Manifest (installability), Service
worker (activated), and Lighthouse → PWA. On a phone, Android Chrome shows
the card as soon as `beforeinstallprompt` fires; iPhone Safari shows the
instruction card after ~2 s.

Known Chrome behaviour with any custom install UI: if the user ignores the
card, DevTools logs an informational "banner not shown:
beforeinstallprompt.preventDefault() called" message on phones. Desktop is
never `preventDefault()`-ed, so it stays silent there.
