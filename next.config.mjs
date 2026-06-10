import { execSync } from 'node:child_process'

function resolveGitSha() {
  if (process.env.GIT_SHA) return process.env.GIT_SHA
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return ''
  }
}

// Момент сборки/старта сервера. В Docker это время билда образа = время деплоя.
const BUILD_TIME = new Date().toISOString()
const GIT_SHA = resolveGitSha()

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_BUILD_TIME: BUILD_TIME,
    NEXT_PUBLIC_GIT_SHA: GIT_SHA,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Increase body size limit for large audio file uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '200mb',
    },
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
      },
    ],
  },
}

export default nextConfig
