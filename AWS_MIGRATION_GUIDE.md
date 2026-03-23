# GitHub 이관 & AWS 배포 가이드 (초보자용)

> 이 가이드는 현재 `sug5264-bit/ERP` 저장소를 새 GitHub 계정으로 이관하고,
> Vercel 대신 AWS(Amplify + RDS)로 배포하는 전체 과정을 다룹니다.

---

## 사전 준비물

시작하기 전에 아래 항목을 준비해주세요:

| 항목                  | 설명                                  | 비용                  |
| --------------------- | ------------------------------------- | --------------------- |
| 새 GitHub 계정        | https://github.com 에서 회원가입      | 무료                  |
| AWS 계정              | https://aws.amazon.com 에서 회원가입  | 프리 티어 12개월 무료 |
| 신용카드              | AWS 가입 시 필요 (프리 티어 내 무료)  | -                     |
| Git 설치              | 로컬 PC에 Git 설치                    | 무료                  |
| Node.js 20            | https://nodejs.org 에서 LTS 버전 설치 | 무료                  |
| PostgreSQL 클라이언트 | DB 마이그레이션 시 필요 (선택)        | 무료                  |

---

# PART 1: GitHub 새 계정으로 저장소 이관

## Step 1-1. 새 GitHub 계정 만들기 (이미 있으면 건너뛰기)

1. 브라우저에서 **https://github.com** 접속
2. 우측 상단 **"Sign up"** 클릭
3. 이메일, 비밀번호, 사용자명 입력
4. 이메일 인증 완료

## Step 1-2. 새 계정에서 빈 저장소 만들기

1. 새 계정으로 GitHub 로그인
2. 우측 상단 **"+"** 버튼 → **"New repository"** 클릭
3. 아래와 같이 설정:

   ```
   Repository name: ERP
   Description:     ERP System (선택사항)
   Public/Private:  Private (권장)
   ```

4. **중요: 아래 항목들을 모두 체크 해제** (빈 저장소여야 합니다!)
   - [ ] Add a README file → **체크하지 마세요**
   - [ ] Add .gitignore → **체크하지 마세요**
   - [ ] Choose a license → **체크하지 마세요**

5. **"Create repository"** 클릭

> 화면에 "Quick setup" 페이지가 나오면 성공입니다.
> 이 페이지에 보이는 URL을 메모해두세요:
> `https://github.com/[새_아이디]/ERP.git`

## Step 1-3. 로컬 PC에서 저장소 이관하기

터미널(또는 명령 프롬프트)을 열고, 아래 명령어를 **한 줄씩** 실행합니다.

```bash
# ---- 1단계: 현재 저장소 클론 (아직 없다면) ----
git clone https://github.com/sug5264-bit/ERP.git
cd ERP

# ---- 2단계: 기존 remote 이름 변경 ----
# "origin"을 "old-origin"으로 바꿉니다 (백업 목적)
git remote rename origin old-origin

# ---- 3단계: 새 저장소를 origin으로 추가 ----
# [새_아이디] 부분을 실제 GitHub 아이디로 바꿔주세요!
git remote add origin https://github.com/[새_아이디]/ERP.git

# ---- 4단계: 모든 코드를 새 저장소로 Push ----
git push -u origin --all      # 모든 브랜치 Push
git push origin --tags         # 모든 태그 Push

# ---- 5단계: 확인 ----
git remote -v
# 아래와 같이 출력되면 성공:
# origin   https://github.com/[새_아이디]/ERP.git (fetch)
# origin   https://github.com/[새_아이디]/ERP.git (push)

# ---- 6단계: (선택) 이전 remote 제거 ----
git remote remove old-origin
```

### 문제가 발생했을 때

**"Authentication failed" 오류:**

```bash
# GitHub에서 2021년부터 비밀번호 대신 Personal Access Token이 필요합니다.
# 1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
# 2. "Generate new token" 클릭
# 3. 권한: "repo" 전체 체크
# 4. 생성된 토큰을 비밀번호 대신 입력
```

**"Repository not empty" 오류:**

```bash
# Step 1-2에서 README 등을 체크한 경우 발생합니다.
# 저장소를 삭제하고 다시 만들거나, 아래 명령어로 강제 Push:
git push -u origin --all --force
```

## Step 1-4. 이관 확인

1. 브라우저에서 `https://github.com/[새_아이디]/ERP` 접속
2. 모든 파일과 커밋 히스토리가 보이면 성공!
3. 브랜치 목록도 확인: 좌측 상단 "main" 드롭다운 클릭

---

# PART 2: AWS 계정 설정

## Step 2-1. AWS 계정 만들기 (이미 있으면 건너뛰기)

1. **https://aws.amazon.com** 접속
2. **"AWS 계정 생성"** 클릭
3. 이메일, 비밀번호, 계정 이름 입력
4. 연락처 정보 입력
5. **신용카드 정보 입력** (프리 티어 범위 내에서는 과금되지 않음)
6. 본인 확인 (전화 또는 SMS)
7. 지원 플랜: **"기본 지원 - 무료"** 선택

> AWS 프리 티어 (12개월 무료):
>
> - RDS: db.t3.micro 750시간/월
> - Amplify: 빌드 1000분/월, 호스팅 15GB/월

## Step 2-2. AWS 리전 설정

1. AWS Console 로그인 후
2. **우측 상단**에 리전이 표시됨 (예: "버지니아 북부")
3. 클릭 → **"아시아 태평양 (서울) ap-northeast-2"** 선택

> 반드시 서울 리전을 선택하세요! 한국 사용자에게 가장 빠릅니다.

---

# PART 3: AWS RDS (데이터베이스) 생성

## Step 3-1. RDS 데이터베이스 만들기

1. AWS Console 상단 검색창에 **"RDS"** 입력 → 클릭
2. 좌측 메뉴에서 **"데이터베이스"** 클릭
3. **"데이터베이스 생성"** 버튼 클릭

### 데이터베이스 생성 설정

아래 항목들을 순서대로 선택합니다:

**엔진 옵션:**

```
데이터베이스 생성 방식: "표준 생성" 선택
엔진 유형:            "PostgreSQL" 선택
엔진 버전:            "PostgreSQL 16.x" 선택 (최신 16 버전)
```

**템플릿:**

```
"프리 티어" 선택 (개발/테스트용, 무료)
```

> 프로덕션 환경에서는 "프로덕션"을 선택하세요 (유료).

**설정:**

```
DB 인스턴스 식별자:  erp-database
마스터 사용자 이름:   erp_admin
마스터 암호:         [안전한 비밀번호 입력]
암호 확인:          [같은 비밀번호 다시 입력]
```

> 비밀번호를 꼭 메모해두세요! 나중에 다시 확인할 수 없습니다.

**인스턴스 구성:**

```
DB 인스턴스 클래스:  db.t3.micro (프리 티어)
```

**스토리지:**

```
스토리지 유형:       범용 SSD (gp3)
할당된 스토리지:     20 GiB (프리 티어 최대)
스토리지 자동 조정:  체크 해제 (비용 방지)
```

**연결:**

```
컴퓨팅 리소스:               "EC2 컴퓨팅 리소스에 연결 안 함" 선택
네트워크 유형:               IPv4
VPC:                        기본 VPC
DB 서브넷 그룹:              default
퍼블릭 액세스:               "예" ← 중요! Amplify에서 접근하려면 필요
VPC 보안 그룹:               "새로 생성" 선택
새 VPC 보안 그룹 이름:       erp-database-sg
가용 영역:                   기본 설정 없음
```

**데이터베이스 인증:**

```
"암호 인증" 선택
```

**추가 구성 (하단 펼치기):**

```
초기 데이터베이스 이름:  erp_database    ← 반드시 입력!
자동 백업:              활성화 (기본값)
백업 보존 기간:         7일
암호화:                활성화 (기본값)
```

4. **"데이터베이스 생성"** 클릭

> 데이터베이스가 생성되는 데 5~10분 정도 걸립니다.
> 상태가 "사용 가능"으로 바뀔 때까지 기다리세요.

## Step 3-2. 보안 그룹 설정 (외부 접근 허용)

데이터베이스가 생성되면 보안 그룹을 설정해야 합니다.

1. 생성된 데이터베이스 **"erp-database"** 클릭
2. **"연결 & 보안"** 탭에서:
   - **"엔드포인트"** 를 메모 (예: `erp-database.abc123.ap-northeast-2.rds.amazonaws.com`)
   - **"VPC 보안 그룹"** 아래 보안 그룹 링크 클릭

3. 보안 그룹 화면에서:
   - **"인바운드 규칙"** 탭 → **"인바운드 규칙 편집"** 클릭
   - 규칙 추가:
     ```
     유형:   PostgreSQL
     프로토콜: TCP
     포트:   5432
     소스:   0.0.0.0/0 (모든 곳에서 접근 - 개발 단계)
     ```
   - **"규칙 저장"** 클릭

> 프로덕션에서는 소스를 `0.0.0.0/0` 대신 특정 IP로 제한하세요.
> 나중에 Amplify 배포 후 보안 그룹을 더 엄격하게 수정할 수 있습니다.

## Step 3-3. RDS 연결 정보 정리

아래 형식으로 연결 정보를 메모해두세요:

```
엔드포인트: erp-database.abc123.ap-northeast-2.rds.amazonaws.com
포트:       5432
사용자:     erp_admin
비밀번호:   [설정한 비밀번호]
DB 이름:    erp_database

DATABASE_URL: postgresql://erp_admin:[비밀번호]@erp-database.abc123.ap-northeast-2.rds.amazonaws.com:5432/erp_database?sslmode=require
```

## Step 3-4. 데이터베이스 테이블 생성 (Prisma)

로컬 터미널에서 실행합니다.

```bash
# ERP 프로젝트 폴더로 이동
cd ERP

# .env 파일 생성 (없으면)
# .env.example을 복사해서 만들어도 됩니다
cp .env.example .env
```

`.env` 파일을 텍스트 편집기로 열어서 아래 내용으로 수정:

```env
DATABASE_URL="postgresql://erp_admin:[비밀번호]@[RDS_엔드포인트]:5432/erp_database?sslmode=require"
DIRECT_URL="postgresql://erp_admin:[비밀번호]@[RDS_엔드포인트]:5432/erp_database?sslmode=require"
AUTH_SECRET="나중에_설정"
AUTH_URL="http://localhost:3000"
NEXTAUTH_URL="http://localhost:3000"
```

> `[비밀번호]`와 `[RDS_엔드포인트]`를 실제 값으로 바꿔주세요!

```bash
# 패키지 설치
npm install

# 데이터베이스에 테이블 생성
npx prisma db push

# 성공하면 이런 메시지가 나옵니다:
# 🚀 Your database is now in sync with your Prisma schema.

# 초기 데이터 입력 (관리자 계정 등)
npx tsx prisma/seed.ts
```

### 데이터 마이그레이션 (기존 Neon DB에 데이터가 있는 경우)

기존 Neon에 실제 사용 중인 데이터가 있다면:

```bash
# 1. 먼저 pg_dump 설치 확인
pg_dump --version
# 설치 안 됐으면:
# Mac: brew install postgresql
# Ubuntu: sudo apt install postgresql-client
# Windows: PostgreSQL 설치 시 포함

# 2. Neon에서 데이터 백업 (한 줄로 입력)
pg_dump "postgresql://[Neon유저]:[Neon비밀번호]@[Neon주소]/neondb?sslmode=require" --format=custom --no-owner --no-acl -f erp_backup.dump

# 3. RDS에 복원 (한 줄로 입력)
pg_restore --host=[RDS_엔드포인트] --port=5432 --username=erp_admin --dbname=erp_database --no-owner --no-acl erp_backup.dump
# 비밀번호 입력 프롬프트가 나오면 RDS 비밀번호 입력
```

---

# PART 4: AWS Amplify 배포

## Step 4-1. Amplify 앱 만들기

1. AWS Console 상단 검색창에 **"Amplify"** 입력 → 클릭
2. **"새 앱 만들기"** 클릭 (또는 "Create new app")
3. **"GitHub"** 선택 → **"다음"** 클릭

## Step 4-2. GitHub 연결

1. GitHub 로그인 화면이 나타남
2. **새 GitHub 계정**으로 로그인
3. **"Authorize AWS Amplify"** 클릭 (권한 허용)
4. 저장소 목록에서 **"ERP"** 선택
5. 브랜치: **"main"** 선택
6. **"다음"** 클릭

## Step 4-3. 빌드 설정

1. 앱 이름: `erp-system` (원하는 이름)
2. 빌드 설정:
   - **"amplify.yml 파일 자동 감지"** 로 표시됨
   - 프로젝트에 이미 `amplify.yml`이 포함되어 있으므로 자동으로 인식
3. 아래와 같은 빌드 스펙이 보이면 정상:
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm ci
           - npx prisma generate
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: .next
       files:
         - '**/*'
     cache:
       paths:
         - node_modules/**/*
         - .next/cache/**/*
   ```
4. **"다음"** 클릭

## Step 4-4. 환경 변수 설정 (매우 중요!)

배포 전에 환경 변수를 설정해야 합니다.

1. Amplify 앱 화면 → 좌측 메뉴 **"호스팅" → "환경 변수"** 클릭
2. **"변수 관리"** 클릭
3. 아래 5개 변수를 하나씩 추가:

| 변수 이름      | 값                                                                                    | 설명                          |
| -------------- | ------------------------------------------------------------------------------------- | ----------------------------- |
| `DATABASE_URL` | `postgresql://erp_admin:[비밀번호]@[RDS엔드포인트]:5432/erp_database?sslmode=require` | RDS 연결 URL                  |
| `DIRECT_URL`   | `postgresql://erp_admin:[비밀번호]@[RDS엔드포인트]:5432/erp_database?sslmode=require` | RDS 직접 연결 URL (위와 동일) |
| `AUTH_SECRET`  | (아래 참고)                                                                           | NextAuth 암호화 키            |
| `AUTH_URL`     | `https://[앱ID].amplifyapp.com`                                                       | 앱 URL                        |
| `NEXTAUTH_URL` | `https://[앱ID].amplifyapp.com`                                                       | 앱 URL (위와 동일)            |

**AUTH_SECRET 생성 방법:**

터미널에서 아래 명령어를 실행하면 랜덤 키가 생성됩니다:

```bash
openssl rand -base64 32
# 출력 예시: K7gN3xP2mQ8vR5tY1wB4nJ6hC9eF0dA3sL8kU2iM7oX=
# 이 값을 AUTH_SECRET에 넣으세요
```

> `openssl`이 없으면 아무 긴 랜덤 문자열을 사용해도 됩니다 (32자 이상 권장).

**AUTH_URL / NEXTAUTH_URL 값:**

- 처음에는 Amplify가 제공하는 기본 URL을 사용합니다
- 앱 배포 후 Amplify 콘솔에서 확인 가능 (예: `https://main.d1abc2def3.amplifyapp.com`)
- 처음에 임시값을 넣고, 첫 배포 후 실제 URL로 수정해도 됩니다

4. **"저장"** 클릭

## Step 4-5. 첫 배포 시작

1. Amplify 앱 화면으로 돌아가기
2. **"저장 및 배포"** (또는 "Save and deploy") 클릭
3. 빌드가 시작됩니다

### 빌드 진행 상태:

```
✅ 프로비저닝  (Provision)    → 서버 준비 중
✅ 빌드       (Build)        → npm install + next build
✅ 배포       (Deploy)       → 빌드 결과물 배포
✅ 확인       (Verify)       → 배포 확인
```

> 첫 빌드는 5~15분 정도 걸릴 수 있습니다.
> 각 단계를 클릭하면 상세 로그를 볼 수 있습니다.

## Step 4-6. 배포 확인

1. 모든 단계가 녹색 체크(✅)가 되면 배포 성공!
2. 화면에 표시된 URL 클릭 (예: `https://main.d1abc2def3.amplifyapp.com`)
3. ERP 로그인 화면이 나타나면 성공!

### 빌드 실패 시 확인사항

**"Prisma Client 에러":**

- 환경 변수 `DATABASE_URL`이 올바른지 확인
- RDS 보안 그룹에서 5432 포트가 열려있는지 확인

**"Module not found" 에러:**

- Amplify 빌드 로그에서 어떤 모듈이 없는지 확인
- `package.json`에 해당 패키지가 있는지 확인

**"AUTH_SECRET" 에러:**

- 환경 변수에 `AUTH_SECRET`이 설정되어 있는지 확인

**빌드 로그 확인 방법:**

1. Amplify 콘솔 → 앱 선택 → 배포 항목 클릭
2. "빌드" 단계 클릭 → 하단에 로그가 표시됨

## Step 4-7. 배포 후 AUTH_URL 업데이트

첫 배포가 성공하면:

1. 배포된 앱의 실제 URL을 확인 (예: `https://main.d1abc2def3.amplifyapp.com`)
2. Amplify 콘솔 → 환경 변수에서:
   - `AUTH_URL` 값을 실제 URL로 수정
   - `NEXTAUTH_URL` 값을 실제 URL로 수정
3. 저장 후 **재배포** (Amplify에서 "재배포" 버튼 클릭)

---

# PART 5: 자동 배포 확인

## GitHub에 Push하면 자동 배포

Amplify를 GitHub와 연결했으므로, 이제부터는:

1. 코드를 수정하고
2. `git push origin main`을 하면
3. **자동으로 빌드 & 배포**가 시작됩니다!

```bash
# 예시: 코드 수정 후 Push
git add .
git commit -m "fix: 버그 수정"
git push origin main
# → Amplify에서 자동으로 빌드 시작!
```

## GitHub Actions CI도 동시에 실행

`.github/workflows/ci.yml` 파일 덕분에:

- Pull Request를 만들면 자동으로 **lint + build 테스트**가 실행됩니다
- main 브랜치에 Push하면 CI 테스트 + Amplify 배포가 동시에 진행됩니다

### GitHub Actions에 환경 변수 설정 (CI용)

GitHub Actions가 정상 작동하려면 GitHub에도 환경 변수(Secrets)를 등록해야 합니다.

1. GitHub 저장소 → **"Settings"** 탭
2. 좌측 메뉴 → **"Secrets and variables"** → **"Actions"**
3. **"New repository secret"** 클릭
4. 아래 값들을 하나씩 추가:

| Name           | Value            |
| -------------- | ---------------- |
| `DATABASE_URL` | RDS 연결 URL     |
| `DIRECT_URL`   | RDS 연결 URL     |
| `AUTH_SECRET`  | 생성한 시크릿 키 |
| `AUTH_URL`     | Amplify 앱 URL   |
| `NEXTAUTH_URL` | Amplify 앱 URL   |

---

# PART 6: Vercel 정리

AWS 배포가 정상 작동하는 것을 확인한 후에 진행합니다.

## Step 6-1. Vercel 프로젝트 삭제

1. **https://vercel.com** 접속 → 로그인
2. 해당 프로젝트 클릭
3. **"Settings"** 탭
4. 맨 아래 스크롤 → **"Delete Project"** 영역
5. 프로젝트 이름 입력 후 삭제

## Step 6-2. 커스텀 도메인 사용 중이었다면

기존에 커스텀 도메인을 Vercel에 연결해서 사용하고 있었다면:

1. DNS 설정으로 이동 (도메인 구매한 곳: 가비아, Route 53 등)
2. 기존 Vercel CNAME 레코드 삭제
3. Amplify에서 제공하는 CNAME 값으로 변경:
   - Amplify 콘솔 → "도메인 관리" → "도메인 추가"에서 확인 가능

## Step 6-3. (선택) vercel.json 삭제

프로젝트에서 더 이상 필요 없는 Vercel 관련 파일을 삭제할 수 있습니다:

```bash
# vercel.json 삭제
git rm vercel.json
git rm .vercelignore

git commit -m "chore: Vercel 관련 설정 파일 제거"
git push origin main
```

> 보안 헤더 설정은 `next.config.ts`에 이미 포함되어 있으므로
> `vercel.json`을 삭제해도 보안에 영향 없습니다.

---

# PART 7: 커스텀 도메인 연결 (선택)

자신만의 도메인(예: `erp.mycompany.com`)을 사용하고 싶다면:

## Step 7-1. Amplify에서 도메인 추가

1. Amplify 콘솔 → 앱 선택
2. 좌측 메뉴 → **"호스팅" → "도메인 관리"**
3. **"도메인 추가"** 클릭
4. 도메인 입력 (예: `mycompany.com`)
5. 서브도메인 설정 (예: `erp.mycompany.com` → main 브랜치)

## Step 7-2. DNS 설정

Amplify에서 제공하는 CNAME 값을 DNS에 등록합니다.

**Route 53 사용 시:** Amplify가 자동으로 설정해줍니다.

**외부 DNS (가비아, Cloudflare 등) 사용 시:**

```
타입:  CNAME
이름:  erp (또는 원하는 서브도메인)
값:    d1abc2def3.cloudfront.net (Amplify에서 제공하는 값)
```

> SSL 인증서는 Amplify가 자동으로 발급합니다 (무료).

---

# 전체 체크리스트

진행하면서 하나씩 체크해주세요:

```
PART 1: GitHub 이관
  [ ] 새 GitHub 계정 생성
  [ ] 빈 저장소 생성 (README 체크 해제)
  [ ] git remote 변경 및 Push
  [ ] 브라우저에서 새 저장소 확인

PART 3: AWS RDS
  [ ] RDS PostgreSQL 인스턴스 생성
  [ ] 보안 그룹 5432 포트 개방
  [ ] 엔드포인트 메모
  [ ] Prisma로 테이블 생성 (npx prisma db push)
  [ ] 시드 데이터 입력 (npx tsx prisma/seed.ts)

PART 4: AWS Amplify
  [ ] Amplify 앱 생성
  [ ] GitHub 저장소 연결
  [ ] 환경 변수 5개 설정
  [ ] 첫 빌드 & 배포 성공
  [ ] AUTH_URL 실제 URL로 업데이트
  [ ] 웹사이트 접속 & 로그인 테스트

PART 5: CI/CD
  [ ] GitHub Secrets 설정

PART 6: 정리
  [ ] Vercel 프로젝트 삭제
  [ ] (선택) vercel.json 삭제

PART 7: (선택) 커스텀 도메인
  [ ] Amplify 도메인 추가
  [ ] DNS 설정
```

---

# 참고: 비용 안내

## 프리 티어 (12개월 무료)

| 서비스            | 프리 티어 한도 | 초과 시 예상 비용 |
| ----------------- | -------------- | ----------------- |
| RDS (db.t3.micro) | 750시간/월     | ~$15/월           |
| RDS 스토리지      | 20GB           | $0.131/GB/월      |
| Amplify 빌드      | 1,000분/월     | $0.01/분          |
| Amplify 호스팅    | 15GB 전송/월   | $0.15/GB          |

> 프리 티어 12개월이 지나면 RDS 비용이 발생합니다.
> 사용하지 않을 때는 RDS 인스턴스를 "중지"하면 비용을 절약할 수 있습니다.
> (RDS → 데이터베이스 선택 → 작업 → 일시 중지)

---

# 참고: 주요 변경 사항 요약

| 항목   | 이전 (Vercel)   | 이후 (AWS)                        |
| ------ | --------------- | --------------------------------- |
| 호스팅 | Vercel          | AWS Amplify                       |
| 리전   | icn1 (서울)     | ap-northeast-2 (서울)             |
| DB     | Neon PostgreSQL | AWS RDS PostgreSQL                |
| CI/CD  | Vercel Git 연동 | Amplify Git 연동 + GitHub Actions |
| SSL    | Vercel 자동     | Amplify 자동                      |
| CDN    | Vercel Edge     | CloudFront (Amplify 내장)         |
| 비용   | Vercel 요금     | AWS 프리 티어 (12개월 무료)       |

---

# 도움이 필요할 때

- **AWS 공식 문서:** https://docs.aws.amazon.com/amplify/
- **Prisma 문서:** https://www.prisma.io/docs
- **Next.js on Amplify:** https://docs.aws.amazon.com/amplify/latest/userguide/ssr-nextjs.html
