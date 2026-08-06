import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  devIndicators: false,
  // Allow large ZIP uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
}

export default nextConfig
