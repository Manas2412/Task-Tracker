'use client';

/**
 * Root crash fallback. It replaces the root layout entirely (renders its own
 * <html>/<body>), so it does NOT get the app's token stylesheet or the layout's
 * theme-init script. To still honour dark mode it carries a tiny self-contained
 * theme setup: a script that mirrors the saved toggle onto data-theme, plus an
 * inline <style> whose colours react to BOTH `prefers-color-scheme` and
 * `[data-theme="dark"]`. Everything degrades to the light palette if scripting
 * or storage is unavailable, keeping the fallback bulletproof.
 */

const THEME_VARS_DARK =
  '--ge-bg:#0e0e11;--ge-panel:#1c1c21;--ge-ink:#ececef;--ge-ink-2:#b2b2b8;--ge-ink-3:#86868d;--ge-line:#2d2d34;';

const GE_STYLE = `
  html.ge{color-scheme:light dark}
  .ge-body{--ge-bg:#fafaf8;--ge-panel:#fff;--ge-ink:#1a1a1a;--ge-ink-2:#666;--ge-ink-3:#999;--ge-line:#ddd}
  @media (prefers-color-scheme: dark){.ge-body{${THEME_VARS_DARK}}}
  html[data-theme="dark"] .ge-body{${THEME_VARS_DARK}}
`;

const GE_THEME_INIT = `try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="ge">
      <body
        className="ge-body"
        style={{
          fontFamily: 'Manrope, system-ui, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          margin: 0,
          backgroundColor: 'var(--ge-bg)',
          color: 'var(--ge-ink)',
        }}
      >
        <script dangerouslySetInnerHTML={{ __html: GE_THEME_INIT }} />
        <style dangerouslySetInnerHTML={{ __html: GE_STYLE }} />
        <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ge-ink-2)', lineHeight: 1.6, marginBottom: 20 }}>
            An unexpected error occurred. If this keeps happening, contact your
            Super Admin.
          </p>
          {error.digest ? (
            <p style={{ fontSize: 11, color: 'var(--ge-ink-3)', marginBottom: 16 }}>
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '10px 24px',
              fontSize: 13,
              fontWeight: 500,
              border: '1px solid var(--ge-line)',
              borderRadius: 8,
              background: 'var(--ge-panel)',
              color: 'var(--ge-ink)',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
