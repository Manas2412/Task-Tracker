/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
    // argon2 is a native module; keep it out of the bundler so it loads via require.
    // (Top-level `serverExternalPackages` landed in Next 15; on 14 it lives here.)
    serverComponentsExternalPackages: ['argon2'],
  },
};

export default nextConfig;
