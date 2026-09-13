import type { NextConfig } from 'next'

const apiUrl = process.env.API_URL ?? 'http://localhost:3333'

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }]
  },
}

export default nextConfig