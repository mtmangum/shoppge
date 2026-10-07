import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js'

/** @type {import('next').NextConfig} */
// No Content-Security-Policy yet: Next injects inline scripts, so a useful CSP
// needs per-request nonces. Add one before v2 rather than a permissive stub.
export const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',   // required for Docker deployment
  experimental: {
    serverActions: { allowedOrigins: ['shop.pge.utexas.edu'] },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default (phase) => ({
  ...nextConfig,
  // Keep production builds from overwriting a running dev server's assets.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
})
