import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allow large ZIP uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
}

export default nextConfig
