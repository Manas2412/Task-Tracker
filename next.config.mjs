const s3Endpoint = process.env.S3_ENDPOINT || '';
const s3Bucket = process.env.S3_BUCKET || '';
const s3Region = process.env.S3_REGION || 'ap-south-1';
const s3ConnectSrc = (() => {
  if (!s3Endpoint) return '';
  try {
    const url = new URL(s3Endpoint);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return `${url.origin}`;
    }
  } catch { /* ignore */ }
  if (s3Bucket) {
    return `https://${s3Bucket}.s3.${s3Region}.amazonaws.com https://s3.${s3Region}.amazonaws.com`;
  }
  return s3Endpoint;
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              `connect-src 'self' https://www.google-analytics.com https://analytics.google.com${s3ConnectSrc ? ' ' + s3ConnectSrc : ''}`,
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
      // The service worker must never be served stale — updates to sw.js are
      // how every cached client eventually converges on new behaviour.
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, max-age=0, must-revalidate' }],
      },
      // PWA imagery is content-addressed by convention: if the artwork ever
      // changes, the filenames change with it (see docs/PWA.md).
      {
        source: '/icons/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/splash/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
