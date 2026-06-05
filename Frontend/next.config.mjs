/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Keep lowercase URLs stable while the tracked route folders still use uppercase names.
      {
        source: "/admin/:path*",
        destination: "/Admin/:path*",
      },
      {
        source: "/student/:path*",
        destination: "/Student/:path*",
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/Admin/:path*",
        destination: "/admin/:path*",
        permanent: false,
      },
      {
        source: "/Student/:path*",
        destination: "/student/:path*",
        permanent: false,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "8000",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
      },
      {
        protocol: "https",
        hostname: "**.onrender.com",
      },
    ],
  },
};

export default nextConfig;
