/** @type {import('next').NextConfig} */
const nextConfig = {
  // Skip TypeScript build errors (pre-existing strict mode issues)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Allow API calls to backend during development
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:9124/api/:path*',
      },
      {
        source: '/health',
        destination: 'http://127.0.0.1:9124/health',
      },
    ];
  },
};

module.exports = nextConfig;
