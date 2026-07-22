/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',   // required for Docker deployment
  experimental: {
    serverActions: { allowedOrigins: ['shop.pge.utexas.edu'] },
  },
}

export default nextConfig
