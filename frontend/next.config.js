/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
    remotePatterns: [
      { protocol: 'https', hostname: 's3-printful.stage.printful.dev' },
      { protocol: 'https', hostname: 'printful-upload.s3-accelerate.amazonaws.com' },
      { protocol: 'https', hostname: 'files.cdn.printful.com' },
      { protocol: 'https', hostname: 'img.printful.com' },
    ],
  },
}

module.exports = nextConfig
