/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Vercel deployment optimization
  experimental: {
    optimizeCss: true,
  },

  // API rewrites for CORS handling
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://elysian-backend-bd3o.onrender.com/api/:path*',
      },
    ]
  },

  // Headers for WebSocket and CORS
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-elysian-key' },
        ],
      },
    ]
  },

  // Image optimization
  images: {
    domains: ['elysian-backend-bd3o.onrender.com'],
  },
}

module.exports = nextConfig
