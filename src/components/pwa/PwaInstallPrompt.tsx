'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * PWA client glue, mounted once in the root layout:
 *
 *   1. Registers the service worker (production builds only — a worker
 *      caching dev-server chunks breaks HMR).
 *   2. Renders the install prompt card — phones only, never desktop:
 *      - Android (and any Chromium that fires `beforeinstallprompt`):
 *        native one-tap install via the captured event.
 *      - iPhone Safari (no install API): "Share → Add to Home Screen"
 *        instructions.
 *
 * Show rules: never when already running standalone or previously installed
 * (localStorage), at most once per browsing session after any dismissal
 * (sessionStorage), auto-dismisses after 10 s without interaction.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISSED_KEY = 'pwa-install-dismissed'; // sessionStorage — this browsing session
const INSTALLED_KEY = 'pwa-installed'; // localStorage — survives sessions
const AUTO_DISMISS_MS = 10_000;
const EXIT_MS = 260; // matches the SlideOverShell exit duration
const IOS_SHOW_DELAY_MS = 2_000;

/* Storage access throws in some private-mode configurations — same isolated
   try/catch convention as THEME_INIT in the root layout. */
function readStorage(area: 'local' | 'session', key: string): string | null {
  try {
    return (area === 'local' ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(area: 'local' | 'session', key: string, value: string) {
  try {
    (area === 'local' ? window.localStorage : window.sessionStorage).setItem(key, value);
  } catch {
    /* non-fatal */
  }
}
function removeStorage(area: 'local' | 'session', key: string) {
  try {
    (area === 'local' ? window.localStorage : window.sessionStorage).removeItem(key);
  } catch {
    /* non-fatal */
  }
}

/* The root layout stashes a pre-hydration beforeinstallprompt here (Chrome
   can fire it before this component mounts). */
type PwaWindow = Window & { __myasPwaBip?: BeforeInstallPromptEvent };

export function PwaInstallPrompt() {
  const [platform, setPlatform] = useState<'android' | 'ios' | null>(null);
  const [leaving, setLeaving] = useState(false);

  const promptEventRef = useRef<BeforeInstallPromptEvent | null>(null);
  const autoDismissRef = useRef<number | null>(null);
  const exitRef = useRef<number | null>(null);

  const clearAutoDismiss = useCallback(() => {
    if (autoDismissRef.current !== null) {
      window.clearTimeout(autoDismissRef.current);
      autoDismissRef.current = null;
    }
  }, []);

  /** Animate out, then unmount. Marks the session unless the app was installed. */
  const hide = useCallback(
    (markSessionDismissed: boolean) => {
      clearAutoDismiss();
      if (markSessionDismissed) writeStorage('session', DISMISSED_KEY, '1');
      setLeaving(true);
      if (exitRef.current !== null) window.clearTimeout(exitRef.current);
      exitRef.current = window.setTimeout(() => {
        setPlatform(null);
        setLeaving(false);
      }, EXIT_MS);
    },
    [clearAutoDismiss],
  );

  // Service worker — production only, all platforms. In dev, actively
  // unregister instead: a worker left over from a local `next build && next
  // start` run would otherwise serve stale chunks to the dev server.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((registration) => registration.unregister()))
        .catch(() => {});
      return;
    }
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* registration failure (e.g. private mode) is non-fatal */
    });
  }, []);

  // Install-prompt eligibility and platform detection.
  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) {
      // Launched from the home screen — remember so the in-browser visit
      // (where standalone is false again) stays quiet too.
      writeStorage('local', INSTALLED_KEY, '1');
      return;
    }

    const sessionDismissed = () => readStorage('session', DISMISSED_KEY) === '1';

    // Same phone gate as useTaskCardGestures: touch device below the md
    // breakpoint. Desktop and tablets never see the card.
    const isPhone = () =>
      window.matchMedia('(max-width: 767px)').matches &&
      window.matchMedia('(pointer: coarse)').matches;

    const handleInstallPromptEvent = (event: BeforeInstallPromptEvent) => {
      // Desktop: leave Chrome's default behaviour completely alone.
      if (!isPhone()) return;
      // Suppress Chrome's mini-infobar; we present our own card instead.
      event.preventDefault();
      promptEventRef.current = event;
      // The browser firing this event is authoritative proof the app is NOT
      // currently installed — clear any stale flag from a past install.
      removeStorage('local', INSTALLED_KEY);
      if (sessionDismissed()) return;
      setPlatform('android');
    };

    const onBeforeInstallPrompt = (event: Event) =>
      handleInstallPromptEvent(event as BeforeInstallPromptEvent);

    const onAppInstalled = () => {
      writeStorage('local', INSTALLED_KEY, '1');
      hide(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    // Consume an event Chrome fired before hydration (stashed by the inline
    // capture script in the root layout).
    const stashed = (window as PwaWindow).__myasPwaBip;
    if (stashed) {
      (window as PwaWindow).__myasPwaBip = undefined;
      handleInstallPromptEvent(stashed);
    }

    // iPhone Safari never fires beforeinstallprompt — show manual
    // instructions after a short settle delay.
    let iosTimer: number | null = null;
    if (
      /iphone|ipod/i.test(window.navigator.userAgent) &&
      isPhone() &&
      readStorage('local', INSTALLED_KEY) !== '1'
    ) {
      iosTimer = window.setTimeout(() => {
        if (!sessionDismissed()) setPlatform('ios');
      }, IOS_SHOW_DELAY_MS);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      if (iosTimer !== null) window.clearTimeout(iosTimer);
    };
  }, [hide]);

  // Auto-dismiss after 10 s unless the user interacts with the card.
  useEffect(() => {
    if (!platform) return;
    autoDismissRef.current = window.setTimeout(() => hide(true), AUTO_DISMISS_MS);
    return clearAutoDismiss;
  }, [platform, hide, clearAutoDismiss]);

  // Clear pending timers on unmount.
  useEffect(
    () => () => {
      if (exitRef.current !== null) window.clearTimeout(exitRef.current);
    },
    [],
  );

  const install = useCallback(async () => {
    const promptEvent = promptEventRef.current;
    if (!promptEvent) return;
    promptEventRef.current = null;
    clearAutoDismiss();
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        writeStorage('local', INSTALLED_KEY, '1');
        hide(false);
      } else {
        hide(true);
      }
    } catch {
      hide(true);
    }
  }, [clearAutoDismiss, hide]);

  if (!platform) return null;

  return (
    <section
      aria-label="Install app"
      onPointerDownCapture={clearAutoDismiss}
      onFocusCapture={clearAutoDismiss}
      className={cn(
        // z-[35]: above the bottom nav and FAB (z-30), below the nav drawer,
        // search overlay and dropdowns (z-40/50) and modals (z-[60]/[70]).
        'fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-[35] md:hidden',
        'transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none',
        leaving ? 'pointer-events-none translate-y-3 opacity-0' : 'pwa-prompt-in',
      )}
    >
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-panel p-3 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.3)]">
        {/* unoptimized: tiny static asset — keeps self-hosted deploys off the
            image-optimizer (which wants the optional sharp package). */}
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={48}
          height={48}
          unoptimized
          className="h-12 w-12 shrink-0 rounded-xl border border-line-2"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-ink">Install MYAS Tasks</p>
          {platform === 'android' ? (
            <p className="mt-0.5 text-[12px] leading-snug text-ink-3">
              Add the app to your home screen for quick access.
            </p>
          ) : (
            <p className="mt-0.5 text-[12px] leading-snug text-ink-3">
              Tap <i className="ti ti-share-2 align-[-2px] text-[14px] text-ink-2" aria-hidden="true" />{' '}
              Share, then &ldquo;Add to Home Screen&rdquo;.
            </p>
          )}
        </div>
        {platform === 'android' && (
          <button
            type="button"
            onClick={install}
            className="shrink-0 rounded-lg bg-ink px-3.5 py-2 text-[13px] font-medium text-onink transition-colors hover:bg-ink-2 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          >
            Install
          </button>
        )}
        <button
          type="button"
          onClick={() => hide(true)}
          aria-label="Dismiss install prompt"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-line-2 hover:text-ink-2 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <i className="ti ti-x text-[16px]" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
