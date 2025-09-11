/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'printful.com'],
    remotePatterns: [
      { protocol: 'https', hostname: 's3-printful.stage.printful.dev' },
      { protocol: 'https', hostname: 'printful-upload.s3-accelerate.amazonaws.com' },
      { protocol: 'https', hostname: 'files.cdn.printful.com' },
      { protocol: 'https', hostname: 'img.printful.com' },
      { protocol: 'https', hostname: 's3.us-east-005.backblazeb2.com' },
    ],
  },
}

module.exports = nextConfig
