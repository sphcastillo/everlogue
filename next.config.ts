import type {NextConfig} from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '8mb',
    },
  },
  images: {
    qualities: [75, 90],
    remotePatterns: [
      {protocol: 'https', hostname: 'covers.openlibrary.org'},
      {protocol: 'https', hostname: 'books.google.com'},
      {protocol: 'https', hostname: 'books.googleusercontent.com'},
      {protocol: 'https', hostname: 'cdn.sanity.io'},
      {protocol: 'https', hostname: 'img.clerk.com'},
      {protocol: 'https', hostname: 'images.clerk.dev'},
    ],
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
}

export default nextConfig
