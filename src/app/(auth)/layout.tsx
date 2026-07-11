/**
 * Auth route-group layout.
 * Keeps the auth pages free of the in-app top-bar / bottom-nav chrome.
 * Background uses --bg (warm off-white) per Design Tokens §1.1.
 */

// Every login starts in light mode: clear any stored dark preference and force
// the document to light before paint (so the login screen never flashes dark
// when arriving from a prior dark session, and the app that loads after sign-in
// defaults to light until the user toggles dark again).
const RESET_THEME_TO_LIGHT = `(function(){try{localStorage.removeItem('theme')}catch(e){}var d=document.documentElement;d.setAttribute('data-theme','light');d.style.colorScheme='light';try{var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content','#f5f4f0')}catch(e){}})();`;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: RESET_THEME_TO_LIGHT }} />
      <main className="min-h-dvh flex items-center justify-center bg-bg px-5 py-8">
        <div className="w-full max-w-[390px]">{children}</div>
      </main>
    </>
  );
}
