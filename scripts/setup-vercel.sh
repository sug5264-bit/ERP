#!/bin/bash
# Vercel 무료 배포 설정 스크립트
# 사용법: bash scripts/setup-vercel.sh

echo "=== Vercel 무료 배포 설정 ==="
echo ""

# 1. Vercel CLI 설치 확인
if ! command -v vercel &> /dev/null; then
  echo "Vercel CLI 설치 중..."
  npm install -g vercel
fi

# 2. Vercel 로그인
echo "1단계: Vercel 로그인"
vercel login

# 3. 프로젝트 연결
echo ""
echo "2단계: Vercel 프로젝트 연결"
vercel link

# 4. 환경변수 설정
echo ""
echo "3단계: 환경변수 설정"
echo "Vercel 대시보드에서 다음 환경변수를 설정해주세요:"
echo "  - DATABASE_URL (Neon PostgreSQL)"
echo "  - DIRECT_URL (Neon PostgreSQL Direct)"
echo "  - AUTH_SECRET (openssl rand -base64 32 로 생성)"
echo "  - AUTH_URL (배포 URL, 예: https://your-app.vercel.app)"
echo "  - NEXTAUTH_URL (위와 동일)"
echo ""

# 5. .vercel 폴더에서 프로젝트 정보 추출
if [ -f .vercel/project.json ]; then
  ORG_ID=$(cat .vercel/project.json | grep -o '"orgId":"[^"]*"' | cut -d'"' -f4)
  PROJECT_ID=$(cat .vercel/project.json | grep -o '"projectId":"[^"]*"' | cut -d'"' -f4)
  echo "GitHub Secrets에 추가할 값:"
  echo "  VERCEL_ORG_ID: $ORG_ID"
  echo "  VERCEL_PROJECT_ID: $PROJECT_ID"
  echo "  VERCEL_TOKEN: (Vercel 대시보드 > Settings > Tokens 에서 생성)"
fi

# 6. 프로덕션 배포
echo ""
echo "4단계: 프로덕션 배포"
read -p "지금 배포하시겠습니까? (y/n): " DEPLOY
if [ "$DEPLOY" = "y" ]; then
  vercel --prod
  echo ""
  echo "배포 완료! 위 URL로 접속하세요."
fi

echo ""
echo "=== 설정 완료 ==="
echo "이후 main 브랜치에 push하면 GitHub Actions가 자동 배포합니다."
