# GitHub 이관 & AWS 배포 가이드

## 1. GitHub 새 계정으로 저장소 이관

### 방법 A: GitHub Transfer (같은 플랫폼 내 이관)

GitHub 설정에서 직접 이관하는 방법입니다.

1. **현재 저장소에서:**
   - GitHub → Settings → Danger Zone → "Transfer repository"
   - 새 계정의 GitHub 아이디 입력
   - 저장소 이름 확인 후 Transfer 클릭

2. **새 계정에서:**
   - Transfer 요청 수락
   - Issues, Stars, Watchers 등 모두 이전됨

### 방법 B: 새 저장소 생성 후 Push (권장)

커밋 히스토리를 완전히 보존하면서 이관하는 방법입니다.

```bash
# 1. 새 GitHub 계정에서 빈 저장소 생성 (README 초기화 하지 않기)
#    https://github.com/new 에서 "ERP" 저장소 생성

# 2. 로컬에서 remote 변경
git remote rename origin old-origin
git remote add origin https://github.com/[새_아이디]/ERP.git

# 3. 모든 브랜치와 태그 Push
git push -u origin --all
git push origin --tags

# 4. 정상 확인 후 이전 remote 제거
git remote remove old-origin
```

### 방법 C: Mirror Clone (완전 복제)

```bash
# 1. 현재 저장소를 bare clone
git clone --mirror https://github.com/sug5264-bit/ERP.git ERP.git

# 2. 새 저장소로 push
cd ERP.git
git push --mirror https://github.com/[새_아이디]/ERP.git

# 3. 정리
cd ..
rm -rf ERP.git
```

---

## 2. AWS 인프라 설정

### 2-1. AWS RDS PostgreSQL 생성

1. **AWS Console → RDS → 데이터베이스 생성**
   - 엔진: PostgreSQL 16
   - 템플릿: 프리 티어 (개발) 또는 프로덕션
   - DB 인스턴스 식별자: `erp-database`
   - 마스터 사용자: `erp_admin`
   - 마스터 암호: 안전한 비밀번호 설정
   - 리전: `ap-northeast-2` (서울)

2. **연결 설정**
   - VPC: 기본 VPC 또는 전용 VPC
   - 퍼블릭 액세스: Amplify 사용 시 `예` (보안 그룹으로 제한)
   - 보안 그룹: Amplify IP 범위에서만 5432 포트 허용

3. **RDS 엔드포인트 확인**
   ```
   erp-database.xxxxxxxxxxxx.ap-northeast-2.rds.amazonaws.com
   ```

4. **DATABASE_URL 형식**
   ```
   postgresql://erp_admin:[PASSWORD]@erp-database.xxxx.ap-northeast-2.rds.amazonaws.com:5432/erp_database?sslmode=require
   ```

### 2-2. 데이터 마이그레이션 (Neon → RDS)

```bash
# 1. Neon에서 데이터 덤프
pg_dump "postgresql://[USER]:[PASS]@[PROJECT].neon.tech/neondb?sslmode=require" \
  --format=custom --no-owner --no-acl \
  -f erp_backup.dump

# 2. RDS에 복원
pg_restore --host=erp-database.xxxx.ap-northeast-2.rds.amazonaws.com \
  --port=5432 --username=erp_admin --dbname=erp_database \
  --no-owner --no-acl \
  erp_backup.dump

# 또는 Prisma로 스키마만 생성 후 시드 실행
npx prisma db push
npx tsx prisma/seed.ts
```

---

## 3. AWS Amplify 배포

### 3-1. Amplify 앱 생성

1. **AWS Console → Amplify → 새 앱 → GitHub에서 호스팅**
2. **GitHub 저장소 연결**
   - 새 GitHub 계정으로 인증
   - `ERP` 저장소 선택
   - 브랜치: `main`
3. **빌드 설정**
   - `amplify.yml`이 자동 감지됨
   - 프레임워크: Next.js (자동 감지)
4. **환경 변수 설정** (Amplify Console → 환경 변수)
   ```
   DATABASE_URL=postgresql://erp_admin:[PASS]@[RDS_ENDPOINT]:5432/erp_database?sslmode=require
   DIRECT_URL=postgresql://erp_admin:[PASS]@[RDS_ENDPOINT]:5432/erp_database?sslmode=require
   AUTH_SECRET=[openssl rand -base64 32 결과]
   AUTH_URL=https://[amplify-app-id].amplifyapp.com
   NEXTAUTH_URL=https://[amplify-app-id].amplifyapp.com
   ```
5. **배포** → Save and Deploy

### 3-2. 커스텀 도메인 (선택)

1. Amplify Console → 도메인 관리 → 도메인 추가
2. Route 53 또는 외부 DNS에서 CNAME 설정
3. SSL 인증서 자동 발급됨

### 3-3. Amplify 환경 분리 (선택)

- `main` 브랜치 → 프로덕션
- `develop` 브랜치 → 스테이징
- 각 브랜치별 환경 변수 분리 가능

---

## 4. Vercel 정리

배포가 안정화된 후:

1. **Vercel 프로젝트 삭제**
   - Vercel Dashboard → Project Settings → Delete Project
2. **DNS 레코드 변경** (커스텀 도메인 사용 시)
   - Vercel CNAME → Amplify CNAME으로 변경
3. **`vercel.json` 파일은 참고용으로 유지하거나 삭제**
   - 보안 헤더 설정은 `next.config.ts`에 이미 포함되어 있음

---

## 5. 체크리스트

- [ ] 새 GitHub 계정에 저장소 이관 완료
- [ ] AWS RDS PostgreSQL 인스턴스 생성
- [ ] 데이터 마이그레이션 (Neon → RDS) 완료
- [ ] AWS Amplify 앱 생성 및 GitHub 연결
- [ ] 환경 변수 설정 (DATABASE_URL, AUTH_SECRET 등)
- [ ] 빌드 및 배포 성공 확인
- [ ] 커스텀 도메인 설정 (필요 시)
- [ ] Vercel 프로젝트 정리
- [ ] Neon PostgreSQL 정리 (데이터 이전 확인 후)

---

## 참고: 주요 변경 사항

| 항목 | 이전 (Vercel) | 이후 (AWS) |
|------|-------------|-----------|
| 호스팅 | Vercel | AWS Amplify |
| 리전 | icn1 (서울) | ap-northeast-2 (서울) |
| DB | Neon PostgreSQL | AWS RDS PostgreSQL |
| CI/CD | Vercel Git 연동 | Amplify Git 연동 + GitHub Actions |
| SSL | Vercel 자동 | Amplify 자동 |
| CDN | Vercel Edge | CloudFront (Amplify 내장) |
