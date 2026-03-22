-- ============================================================
-- Migration 07: login_attempts 테이블 (서버리스 DB 기반 rate limiting)
-- 서버리스 환경에서 인메모리 rate limiting은 인스턴스 간 상태가 공유되지 않으므로,
-- 로그인 시도 횟수를 DB에 기록하여 정확한 rate limiting을 구현합니다.
-- ============================================================

CREATE TABLE IF NOT EXISTS "login_attempts" (
  "id"         TEXT         NOT NULL,
  "username"   TEXT         NOT NULL,
  "ipAddress"  TEXT         NOT NULL,
  "success"    BOOLEAN      NOT NULL,
  "createdAt"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- 사용자명 + 시간 기준 조회 최적화 (rate limit 체크)
CREATE INDEX IF NOT EXISTS "login_attempts_username_createdAt_idx"
  ON "login_attempts" ("username", "createdAt");

-- IP 기준 조회 최적화 (IP 블록 체크)
CREATE INDEX IF NOT EXISTS "login_attempts_ipAddress_createdAt_idx"
  ON "login_attempts" ("ipAddress", "createdAt");

-- RLS 활성화 (service_role만 접근)
ALTER TABLE "login_attempts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON "login_attempts"
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 오래된 로그인 시도 자동 정리 (30일 이상 된 레코드 삭제)
-- 운영 환경에서 pg_cron 또는 별도 배치로 아래 쿼리를 주기적으로 실행하세요:
-- DELETE FROM "login_attempts" WHERE "createdAt" < NOW() - INTERVAL '30 days';
