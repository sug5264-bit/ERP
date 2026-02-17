import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  // 대용량 패키지 트리쉐이킹 최적화
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'date-fns',
      'radix-ui',
      'exceljs',
    ],
  },
  // 서버 로깅
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
  // 이미지 최적화
  images: {
    formats: ['image/avif', 'image/webp'],
  },
}

export default nextConfig
