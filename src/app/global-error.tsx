'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'Manrope, system-ui, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          margin: 0,
          backgroundColor: '#fafaf8',
          color: '#1a1a1a',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6, marginBottom: 20 }}>
            An unexpected error occurred. If this keeps happening, contact your
            Super Admin.
          </p>
          {error.digest ? (
            <p style={{ fontSize: 11, color: '#999', marginBottom: 16 }}>
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
              border: '1px solid #ddd',
              borderRadius: 8,
              background: '#fff',
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
