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
    // 클라이언트 라우터 캐시 (동적 페이지 30초, 정적 페이지 5분 캐싱)
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
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
  // 빌드 시 소스맵 비활성화 (번들 크기 감소)
  productionBrowserSourceMaps: false,
}

export default nextConfig
