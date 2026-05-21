/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
      {
        source: '/ws',
        destination: 'http://localhost:3001/ws',
      },
    ]
  },
}

module.exports = nextConfig
