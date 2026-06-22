/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Pochettes Deezer / iTunes servies depuis des CDN externes.
    remotePatterns: [
      { protocol: "https", hostname: "**.dzcdn.net" },
      { protocol: "https", hostname: "**.mzstatic.com" },
    ],
  },
};

module.exports = nextConfig;
