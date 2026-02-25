import type { NextConfig } from 'next'

const securityHeaders = [
  // XSS 보호
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // MIME 스니핑 방지
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // 클릭재킹 방지
  { key: 'X-Frame-Options', value: 'DENY' },
  // 리퍼러 정보 제한
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // 브라우저 기능 제한
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  // HTTPS 강제 (프로덕션)
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
    : []),
  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // unsafe-eval은 개발 환경에서만 허용 (React DevTools 등)
      process.env.NODE_ENV === 'production'
        ? "script-src 'self' 'unsafe-inline'"
        : "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Docker/standalone 배포 지원 (Vercel에서도 호환)
  output: 'standalone',
  // 보안 헤더
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      // API 응답: 캐시 금지 (민감 데이터)
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
      // 정적 자산: 장기 캐시
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
  // 대용량 패키지 트리쉐이킹 최적화
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'date-fns',
      'radix-ui',
      'exceljs',
      'zod',
      '@tanstack/react-query',
      '@tanstack/react-table',
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
  // X-Powered-By 헤더 제거
  poweredByHeader: false,
  // 압축 활성화
  compress: true,
}

export default nextConfig
