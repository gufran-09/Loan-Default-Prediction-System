/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.BUILD_STANDALONE === 'true' || process.env.DOCKER_BUILD === '1'
    ? { output: 'standalone' }
    : {}),
  images: {
    unoptimized: true,
  },
  experimental: {
    cpus: 1,
    staticGenerationMaxConcurrency: 1,
  },
}

export default nextConfig
