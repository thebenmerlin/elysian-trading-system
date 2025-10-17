/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // ✅ Removed deprecated experimental.optimizeCss to fix "Cannot find module 'critters'" error

  // Vercel deployment optimization and rewrites
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://elysian-backend-bd3o.onrender.com/api/:path*',
      },
    ]
  },

  // ✅ Headers for WebSocket and CORS support
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          {
            key: 'Access-Control-Allow-Headers',
            value:
              'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-elysian-key',
          },
        ],
      },
    ]
  },

  // ✅ Image optimization (kept)
  images: {
    domains: ['elysian-backend-bd3o.onrender.com'],
  },
}

module.exports = nextConfig