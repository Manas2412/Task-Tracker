/**
 * Auth route-group layout.
 * Keeps the auth pages free of the in-app top-bar / bottom-nav chrome.
 * Background uses --bg (warm off-white) per Design Tokens §1.1.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh flex items-center justify-center bg-bg px-5 py-8">
      <div className="w-full max-w-[390px]">{children}</div>
    </main>
  );
}
