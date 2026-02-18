/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Make @sentry/nextjs optional - don't fail build if it's not installed
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@sentry/nextjs': false,
      };
    }
    return config;
  },
};

export default nextConfig;

