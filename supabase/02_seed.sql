-- ============================================================
-- ERP Seed Data for Supabase
-- Supabase Dashboard > SQL Editor 에서 실행
-- 반드시 01_schema.sql 실행 후에 실행할 것
-- ============================================================

-- ============================================================
-- 1. 역할 (Roles)
-- ============================================================
INSERT INTO "roles" ("id", "name", "description", "isSystem", "createdAt") VALUES
  ('role-admin', '관리자', '시스템 관리자', true, NOW()),
  ('role-user', '일반사용자', '일반 사용자', false, NOW()),
  ('role-manager', '부서장', '부서 관리자', false, NOW())
ON CONFLICT ("name") DO NOTHING;

-- ============================================================
-- 2. 부서 (Departments)
-- ============================================================
INSERT INTO "departments" ("id", "code", "name", "level", "sortOrder", "isActive") VALUES
  ('dept-mgmt', 'MGMT', '경영지원팀', 1, 1, true),
  ('dept-sales', 'SALES', '영업팀', 1, 2, true),
  ('dept-dev', 'DEV', '개발팀', 1, 3, true),
  ('dept-prod', 'PROD', '생산팀', 1, 4, true),
  ('dept-purchase', 'PURCHASE', '구매팀', 1, 5, true),
  ('dept-acct', 'ACCT', '회계팀', 1, 6, true)
ON CONFLICT ("code") DO NOTHING;

-- ============================================================
-- 3. 직급 (Positions)
-- ============================================================
INSERT INTO "positions" ("id", "code", "name", "level", "sortOrder") VALUES
  ('pos-ceo', 'CEO', '대표이사', 1, 1),
  ('pos-dir', 'DIR', '이사', 2, 2),
  ('pos-mgr', 'MGR', '팀장', 3, 3),
  ('pos-sr', 'SR', '대리', 4, 4),
  ('pos-stf', 'STF', '사원', 5, 5)
ON CONFLICT ("code") DO NOTHING;

-- ============================================================
-- 4. 직원 (Employees)
-- ============================================================
INSERT INTO "employees" ("id", "employeeNo", "nameKo", "departmentId", "positionId", "joinDate", "phone", "email", "createdAt", "updatedAt") VALUES
  ('emp-001', 'EMP-001', '김웰그린', 'dept-mgmt', 'pos-ceo', '2020-01-02', '010-1234-5678', 'kim@wellgreen.co.kr', NOW(), NOW()),
  ('emp-002', 'EMP-002', '박영업', 'dept-sales', 'pos-mgr', '2021-03-15', '010-2345-6789', 'park@wellgreen.co.kr', NOW(), NOW()),
  ('emp-003', 'EMP-003', '이개발', 'dept-dev', 'pos-mgr', '2021-06-01', '010-3456-7890', 'lee@wellgreen.co.kr', NOW(), NOW()),
  ('emp-004', 'EMP-004', '최생산', 'dept-prod', 'pos-mgr', '2022-01-10', '010-4567-8901', 'choi@wellgreen.co.kr', NOW(), NOW()),
  ('emp-005', 'EMP-005', '정구매', 'dept-purchase', 'pos-sr', '2022-05-20', '010-5678-9012', 'jung@wellgreen.co.kr', NOW(), NOW()),
  ('emp-006', 'EMP-006', '한회계', 'dept-acct', 'pos-mgr', '2021-09-01', '010-6789-0123', 'han@wellgreen.co.kr', NOW(), NOW()),
  ('emp-007', 'EMP-007', '강사원', 'dept-sales', 'pos-stf', '2023-03-02', '010-7890-1234', 'kang@wellgreen.co.kr', NOW(), NOW()),
  ('emp-008', 'EMP-008', '윤사원', 'dept-dev', 'pos-stf', '2023-07-15', '010-8901-2345', 'yoon@wellgreen.co.kr', NOW(), NOW()),
  ('emp-009', 'EMP-009', '임대리', 'dept-mgmt', 'pos-sr', '2022-11-01', '010-9012-3456', 'lim@wellgreen.co.kr', NOW(), NOW()),
  ('emp-010', 'EMP-010', '조이사', 'dept-mgmt', 'pos-dir', '2020-06-15', '010-0123-4567', 'jo@wellgreen.co.kr', NOW(), NOW())
ON CONFLICT ("employeeNo") DO NOTHING;

-- ============================================================
-- 5. 사용자 (Users)
-- admin1234 -> $2b$10$mbSYWrZ4HarVDb9NnFDrBuuWzAOpyn528yVNzPWy5pz5ZEuvQJRQ2
-- user1234  -> $2b$10$zhUBG1FWJA9vWwRvntg4OeSHUYkS.Gb5GS/Qzka2xJhJx1KU0kvnG
-- ============================================================
INSERT INTO "users" ("id", "username", "email", "passwordHash", "name", "isActive", "employeeId", "createdAt", "updatedAt") VALUES
  ('user-admin', 'admin', 'admin@wellgreen.co.kr', '$2b$10$mbSYWrZ4HarVDb9NnFDrBuuWzAOpyn528yVNzPWy5pz5ZEuvQJRQ2', '김웰그린', true, 'emp-001', NOW(), NOW()),
  ('user-park', 'parksales', 'park@wellgreen.co.kr', '$2b$10$zhUBG1FWJA9vWwRvntg4OeSHUYkS.Gb5GS/Qzka2xJhJx1KU0kvnG', '박영업', true, 'emp-002', NOW(), NOW()),
  ('user-lee', 'leedev', 'lee@wellgreen.co.kr', '$2b$10$zhUBG1FWJA9vWwRvntg4OeSHUYkS.Gb5GS/Qzka2xJhJx1KU0kvnG', '이개발', true, 'emp-003', NOW(), NOW()),
  ('user-han', 'hanacct', 'han@wellgreen.co.kr', '$2b$10$zhUBG1FWJA9vWwRvntg4OeSHUYkS.Gb5GS/Qzka2xJhJx1KU0kvnG', '한회계', true, 'emp-006', NOW(), NOW()),
  ('user-kang', 'kangstaff', 'kang@wellgreen.co.kr', '$2b$10$zhUBG1FWJA9vWwRvntg4OeSHUYkS.Gb5GS/Qzka2xJhJx1KU0kvnG', '강사원', true, 'emp-007', NOW(), NOW())
ON CONFLICT ("username") DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash";

-- 사용자-역할 매핑
INSERT INTO "user_roles" ("userId", "roleId") VALUES
  ('user-admin', 'role-admin'),
  ('user-park', 'role-manager'),
  ('user-lee', 'role-manager'),
  ('user-han', 'role-user'),
  ('user-kang', 'role-user')
ON CONFLICT ("userId", "roleId") DO NOTHING;

-- ============================================================
-- 6. 계정과목 (Account Subjects)
-- ============================================================
INSERT INTO "account_subjects" ("id", "code", "nameKo", "accountType", "level", "isActive", "taxRelated") VALUES
  ('acc-1010', '1010', '현금', 'ASSET', 2, true, false),
  ('acc-1020', '1020', '보통예금', 'ASSET', 2, true, false),
  ('acc-1100', '1100', '매출채권', 'ASSET', 2, true, false),
  ('acc-1200', '1200', '재고자산', 'ASSET', 2, true, false),
  ('acc-1300', '1300', '선급금', 'ASSET', 2, true, false),
  ('acc-1400', '1400', '미수금', 'ASSET', 2, true, false),
  ('acc-1500', '1500', '유형자산', 'ASSET', 2, true, false),
  ('acc-2100', '2100', '매입채무', 'LIABILITY', 2, true, false),
  ('acc-2200', '2200', '미지급금', 'LIABILITY', 2, true, false),
  ('acc-2300', '2300', '예수금', 'LIABILITY', 2, true, false),
  ('acc-2400', '2400', '부가세예수금', 'LIABILITY', 2, true, true),
  ('acc-2500', '2500', '선수금', 'LIABILITY', 2, true, false),
  ('acc-3100', '3100', '자본금', 'EQUITY', 2, true, false),
  ('acc-3200', '3200', '이익잉여금', 'EQUITY', 2, true, false),
  ('acc-4100', '4100', '매출', 'REVENUE', 2, true, false),
  ('acc-4200', '4200', '기타수익', 'REVENUE', 2, true, false),
  ('acc-5100', '5100', '매출원가', 'EXPENSE', 2, true, false),
  ('acc-5200', '5200', '급여', 'EXPENSE', 2, true, false),
  ('acc-5300', '5300', '복리후생비', 'EXPENSE', 2, true, false),
  ('acc-5400', '5400', '임차료', 'EXPENSE', 2, true, false),
  ('acc-5500', '5500', '접대비', 'EXPENSE', 2, true, false),
  ('acc-5600', '5600', '통신비', 'EXPENSE', 2, true, false),
  ('acc-5700', '5700', '소모품비', 'EXPENSE', 2, true, false),
  ('acc-5800', '5800', '감가상각비', 'EXPENSE', 2, true, false)
ON CONFLICT ("code") DO NOTHING;

-- ============================================================
-- 7. 회계연도 (Fiscal Year) - 2026
-- ============================================================
INSERT INTO "fiscal_years" ("id", "year", "startDate", "endDate", "isClosed") VALUES
  ('fy-2026', 2026, '2026-01-01', '2026-12-31', false)
ON CONFLICT ("year") DO NOTHING;

-- ============================================================
-- 8. 거래처 (Partners)
-- ============================================================
INSERT INTO "partners" ("id", "partnerCode", "partnerName", "partnerType", "bizNo", "ceoName", "bizType", "bizCategory", "phone", "email", "address", "createdAt", "updatedAt") VALUES
  ('ptr-001', 'P-001', '(주)한국전자', 'SALES', '123-45-67890', '김전자', '제조업', '전자부품', '02-1234-5678', 'info@hankook-elec.co.kr', '서울시 강남구 테헤란로 123', NOW(), NOW()),
  ('ptr-002', 'P-002', '삼성산업(주)', 'SALES', '234-56-78901', '이산업', '도소매', '산업용품', '02-2345-6789', 'sales@samsung-ind.co.kr', '서울시 서초구 반포대로 45', NOW(), NOW()),
  ('ptr-003', 'P-003', '대한물산', 'BOTH', '345-67-89012', '박물산', '도소매', '종합물류', '031-345-6789', 'contact@daehan.co.kr', '경기도 성남시 분당구 판교로 67', NOW(), NOW()),
  ('ptr-004', 'P-004', '글로벌테크', 'PURCHASE', '456-78-90123', '최테크', '제조업', 'IT장비', '02-4567-8901', 'order@globaltech.co.kr', '서울시 마포구 월드컵북로 89', NOW(), NOW()),
  ('ptr-005', 'P-005', '(주)우리소재', 'PURCHASE', '567-89-01234', '정소재', '제조업', '원자재', '032-567-8901', 'supply@woori-mat.co.kr', '인천시 남동구 남동대로 234', NOW(), NOW()),
  ('ptr-006', 'P-006', '미래유통', 'SALES', '678-90-12345', '한유통', '도소매', '유통', '02-6789-0123', 'biz@mirae-dist.co.kr', '서울시 송파구 올림픽로 345', NOW(), NOW()),
  ('ptr-007', 'P-007', '테크솔루션(주)', 'BOTH', '789-01-23456', '강솔루', '서비스업', 'IT서비스', '02-7890-1234', 'info@techsol.co.kr', '서울시 영등포구 여의대로 56', NOW(), NOW()),
  ('ptr-008', 'P-008', '한빛에너지', 'PURCHASE', '890-12-34567', '윤에너', '제조업', '에너지', '044-890-1234', 'power@hanbit-energy.co.kr', '세종시 한누리대로 78', NOW(), NOW())
ON CONFLICT ("partnerCode") DO NOTHING;

-- ============================================================
-- 9. 품목 카테고리 (Item Categories)
-- ============================================================
INSERT INTO "item_categories" ("id", "code", "name", "level") VALUES
  ('cat-01', 'CAT-01', '전자부품', 1),
  ('cat-02', 'CAT-02', '원자재', 1),
  ('cat-03', 'CAT-03', '완제품', 1),
  ('cat-04', 'CAT-04', '사무용품', 1)
ON CONFLICT ("code") DO NOTHING;

-- ============================================================
-- 10. 품목 (Items)
-- ============================================================
INSERT INTO "items" ("id", "itemCode", "itemName", "specification", "categoryId", "unit", "standardPrice", "itemType", "safetyStock", "createdAt", "updatedAt") VALUES
  ('itm-001', 'ITM-001', 'LED 디스플레이 모듈', '24인치 FHD', 'cat-01', 'EA', 150000, 'PRODUCT', 50, NOW(), NOW()),
  ('itm-002', 'ITM-002', '전원공급장치 500W', 'ATX 500W 80+', 'cat-01', 'EA', 85000, 'PRODUCT', 100, NOW(), NOW()),
  ('itm-003', 'ITM-003', 'PCB 기판 A타입', '150x100mm', 'cat-02', 'EA', 12000, 'RAW_MATERIAL', 200, NOW(), NOW()),
  ('itm-004', 'ITM-004', '알루미늄 방열판', '100x80x30mm', 'cat-02', 'EA', 8500, 'RAW_MATERIAL', 300, NOW(), NOW()),
  ('itm-005', 'ITM-005', '스마트 컨트롤러 V2', 'IoT 지원', 'cat-03', 'SET', 320000, 'PRODUCT', 30, NOW(), NOW()),
  ('itm-006', 'ITM-006', 'USB-C 케이블', '1.5m', 'cat-01', 'EA', 5500, 'GOODS', 500, NOW(), NOW()),
  ('itm-007', 'ITM-007', '센서 모듈 SEN-100', '온도/습도', 'cat-01', 'EA', 45000, 'PRODUCT', 80, NOW(), NOW()),
  ('itm-008', 'ITM-008', '스테인리스 볼트 세트', 'M4/M5/M6 혼합', 'cat-02', 'BOX', 25000, 'SUBSIDIARY', 50, NOW(), NOW()),
  ('itm-009', 'ITM-009', 'A4 복사용지', '80g 2500매', 'cat-04', 'BOX', 28000, 'SUBSIDIARY', 20, NOW(), NOW()),
  ('itm-010', 'ITM-010', '산업용 모니터 15인치', '방수/방진 IP65', 'cat-03', 'EA', 480000, 'PRODUCT', 15, NOW(), NOW())
ON CONFLICT ("itemCode") DO NOTHING;

-- ============================================================
-- 11. 창고 (Warehouses)
-- ============================================================
INSERT INTO "warehouses" ("id", "code", "name", "location", "isActive") VALUES
  ('wh-01', 'WH-01', '본사 창고', '서울시 강남구', true),
  ('wh-02', 'WH-02', '판교 물류센터', '경기도 성남시 분당구', true),
  ('wh-03', 'WH-03', '인천 자재창고', '인천시 남동구', true)
ON CONFLICT ("code") DO NOTHING;

-- 창고 구역
INSERT INTO "warehouse_zones" ("id", "warehouseId", "zoneCode", "zoneName") VALUES
  ('wz-01a', 'wh-01', 'A', 'A구역 - 완제품'),
  ('wz-01b', 'wh-01', 'B', 'B구역 - 원자재'),
  ('wz-01c', 'wh-01', 'C', 'C구역 - 부자재'),
  ('wz-02a', 'wh-02', 'A', 'A구역 - 완제품'),
  ('wz-02b', 'wh-02', 'B', 'B구역 - 원자재'),
  ('wz-02c', 'wh-02', 'C', 'C구역 - 부자재'),
  ('wz-03a', 'wh-03', 'A', 'A구역 - 완제품'),
  ('wz-03b', 'wh-03', 'B', 'B구역 - 원자재'),
  ('wz-03c', 'wh-03', 'C', 'C구역 - 부자재')
ON CONFLICT ("warehouseId", "zoneCode") DO NOTHING;

-- 재고 잔량
INSERT INTO "stock_balances" ("id", "itemId", "warehouseId", "quantity", "averageCost") VALUES
  ('sb-001', 'itm-001', 'wh-01', 120, 150000),
  ('sb-002', 'itm-002', 'wh-01', 250, 85000),
  ('sb-003', 'itm-003', 'wh-03', 500, 12000),
  ('sb-004', 'itm-004', 'wh-03', 800, 8500),
  ('sb-005', 'itm-005', 'wh-01', 45, 320000),
  ('sb-006', 'itm-006', 'wh-02', 1200, 5500),
  ('sb-007', 'itm-007', 'wh-01', 150, 45000),
  ('sb-008', 'itm-008', 'wh-03', 75, 25000),
  ('sb-009', 'itm-009', 'wh-01', 30, 28000),
  ('sb-010', 'itm-010', 'wh-02', 25, 480000)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 12. 견적서 (Quotations)
-- ============================================================
INSERT INTO "quotations" ("id", "quotationNo", "quotationDate", "partnerId", "employeeId", "validUntil", "status", "totalSupply", "totalTax", "totalAmount", "description", "createdAt", "updatedAt") VALUES
  ('qt-001', 'QT-2026-0001', '2026-01-15', 'ptr-001', 'emp-002', '2026-02-15', 'ORDERED', 3200000, 320000, 3520000, 'LED 디스플레이 모듈 공급 견적', NOW(), NOW()),
  ('qt-002', 'QT-2026-0002', '2026-01-20', 'ptr-002', 'emp-002', '2026-02-20', 'SUBMITTED', 4800000, 480000, 5280000, '스마트 컨트롤러 납품 견적', NOW(), NOW())
ON CONFLICT ("quotationNo") DO NOTHING;

INSERT INTO "quotation_details" ("id", "quotationId", "lineNo", "itemId", "quantity", "unitPrice", "supplyAmount", "taxAmount", "totalAmount") VALUES
  ('qtd-001', 'qt-001', 1, 'itm-001', 20, 150000, 3000000, 300000, 3300000),
  ('qtd-002', 'qt-001', 2, 'itm-006', 40, 5000, 200000, 20000, 220000),
  ('qtd-003', 'qt-002', 1, 'itm-005', 15, 320000, 4800000, 480000, 5280000)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 13. 수주 (Sales Orders)
-- ============================================================
INSERT INTO "sales_orders" ("id", "orderNo", "orderDate", "partnerId", "quotationId", "employeeId", "deliveryDate", "totalSupply", "totalTax", "totalAmount", "status", "description", "createdAt", "updatedAt") VALUES
  ('so-001', 'SO-2026-0001', '2026-01-20', 'ptr-001', 'qt-001', 'emp-002', '2026-02-10', 3200000, 320000, 3520000, 'COMPLETED', 'LED 디스플레이 모듈 수주', NOW(), NOW()),
  ('so-002', 'SO-2026-0002', '2026-02-01', 'ptr-003', NULL, 'emp-007', '2026-02-28', 2250000, 225000, 2475000, 'IN_PROGRESS', '센서 모듈 주문', NOW(), NOW()),
  ('so-003', 'SO-2026-0003', '2026-02-10', 'ptr-006', NULL, 'emp-002', '2026-03-15', 9600000, 960000, 10560000, 'ORDERED', '산업용 모니터 대량 주문', NOW(), NOW())
ON CONFLICT ("orderNo") DO NOTHING;

INSERT INTO "sales_order_details" ("id", "salesOrderId", "lineNo", "itemId", "quantity", "unitPrice", "supplyAmount", "taxAmount", "totalAmount", "deliveredQty", "remainingQty") VALUES
  ('sod-001', 'so-001', 1, 'itm-001', 20, 150000, 3000000, 300000, 3300000, 20, 0),
  ('sod-002', 'so-001', 2, 'itm-006', 40, 5000, 200000, 20000, 220000, 40, 0),
  ('sod-003', 'so-002', 1, 'itm-007', 50, 45000, 2250000, 225000, 2475000, 20, 30),
  ('sod-004', 'so-003', 1, 'itm-010', 20, 480000, 9600000, 960000, 10560000, 0, 20)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 14. 전표 (Vouchers)
-- ============================================================
INSERT INTO "vouchers" ("id", "voucherNo", "voucherDate", "voucherType", "description", "totalDebit", "totalCredit", "status", "fiscalYearId", "createdById", "approvedById", "createdAt", "updatedAt") VALUES
  ('v-001', 'V-2026-0001', '2026-01-31', 'SALES', '1월 매출 전표', 3520000, 3520000, 'APPROVED', 'fy-2026', 'emp-006', 'emp-001', NOW(), NOW()),
  ('v-002', 'V-2026-0002', '2026-02-05', 'RECEIPT', '한국전자 매출대금 수금', 3520000, 3520000, 'APPROVED', 'fy-2026', 'emp-006', 'emp-001', NOW(), NOW()),
  ('v-003', 'V-2026-0003', '2026-02-10', 'PAYMENT', '2월 급여 지급', 15000000, 15000000, 'APPROVED', 'fy-2026', 'emp-006', 'emp-001', NOW(), NOW())
ON CONFLICT ("voucherNo") DO NOTHING;

INSERT INTO "voucher_details" ("id", "voucherId", "lineNo", "accountSubjectId", "debitAmount", "creditAmount", "partnerId", "description") VALUES
  -- V-2026-0001: 매출 전표
  ('vd-001', 'v-001', 1, 'acc-1100', 3520000, 0, 'ptr-001', '한국전자 매출채권'),
  ('vd-002', 'v-001', 2, 'acc-4100', 0, 3200000, NULL, '매출'),
  ('vd-003', 'v-001', 3, 'acc-2400', 0, 320000, NULL, '부가세'),
  -- V-2026-0002: 수금 전표
  ('vd-004', 'v-002', 1, 'acc-1020', 3520000, 0, NULL, '보통예금 입금'),
  ('vd-005', 'v-002', 2, 'acc-1100', 0, 3520000, 'ptr-001', '매출채권 회수'),
  -- V-2026-0003: 급여 전표
  ('vd-006', 'v-003', 1, 'acc-5200', 15000000, 0, NULL, '급여'),
  ('vd-007', 'v-003', 2, 'acc-1020', 0, 15000000, NULL, '보통예금 출금')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 15. 게시판 (Boards & Posts)
-- ============================================================
INSERT INTO "boards" ("id", "boardCode", "boardName", "boardType", "isActive") VALUES
  ('board-notice', 'NOTICE', '공지사항', 'NOTICE', true),
  ('board-general', 'GENERAL', '자유게시판', 'GENERAL', true)
ON CONFLICT ("boardCode") DO NOTHING;

INSERT INTO "posts" ("id", "boardId", "title", "content", "authorId", "isPinned", "viewCount", "createdAt", "updatedAt") VALUES
  ('post-001', 'board-notice', '2026년 상반기 경영계획 안내', '안녕하세요, 2026년 상반기 경영계획을 공유드립니다.

1. 매출 목표: 50억원
2. 신규 거래처 확보: 20개사
3. 신제품 출시: 3종

자세한 내용은 첨부파일을 참고해주세요.', 'user-admin', true, 45, NOW(), NOW()),
  ('post-002', 'board-notice', '사내 보안 정책 변경 안내', '2월부터 사내 보안 정책이 변경됩니다.

- USB 사용 제한
- 비밀번호 90일마다 변경 필수
- 2차 인증 도입

협조 부탁드립니다.', 'user-admin', true, 38, NOW(), NOW()),
  ('post-003', 'board-notice', 'ERP 시스템 점검 안내 (2/20)', '2월 20일 오후 6시~8시 ERP 시스템 점검이 진행됩니다.
해당 시간에는 시스템 이용이 제한될 수 있습니다.', 'user-admin', false, 22, NOW(), NOW()),
  ('post-004', 'board-general', '점심 맛집 추천합니다', '회사 근처 새로 생긴 일식집 추천드립니다.
런치 메뉴가 가성비 좋아요!', 'user-admin', false, 15, NOW(), NOW()),
  ('post-005', 'board-general', '이번 주 금요일 회식 참석 여부', '이번 주 금요일 팀 회식이 있습니다.
참석 가능하신 분들은 댓글 남겨주세요.', 'user-admin', false, 28, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ============================================================
-- 16. 출퇴근 기록 (Attendance) - 최근 5 평일
-- ============================================================
INSERT INTO "attendances" ("id", "employeeId", "workDate", "checkInTime", "checkOutTime", "workHours", "overtimeHours", "attendanceType") VALUES
  -- 2026-02-13 (금)
  ('att-0213-001', 'emp-001', '2026-02-13', '2026-02-13 08:15:00', '2026-02-13 18:30:00', 10.25, 2.25, 'NORMAL'),
  ('att-0213-002', 'emp-002', '2026-02-13', '2026-02-13 08:45:00', '2026-02-13 17:30:00', 8.75, 0.75, 'NORMAL'),
  ('att-0213-003', 'emp-003', '2026-02-13', '2026-02-13 09:10:00', '2026-02-13 19:00:00', 9.83, 1.83, 'NORMAL'),
  ('att-0213-006', 'emp-006', '2026-02-13', '2026-02-13 08:30:00', '2026-02-13 17:45:00', 9.25, 1.25, 'NORMAL'),
  ('att-0213-007', 'emp-007', '2026-02-13', '2026-02-13 09:35:00', '2026-02-13 18:00:00', 8.42, 0.42, 'LATE'),
  -- 2026-02-16 (월)
  ('att-0216-001', 'emp-001', '2026-02-16', '2026-02-16 08:00:00', '2026-02-16 18:00:00', 10.00, 2.00, 'NORMAL'),
  ('att-0216-002', 'emp-002', '2026-02-16', '2026-02-16 08:30:00', '2026-02-16 17:30:00', 9.00, 1.00, 'NORMAL'),
  ('att-0216-003', 'emp-003', '2026-02-16', '2026-02-16 08:50:00', '2026-02-16 19:30:00', 10.67, 2.67, 'NORMAL'),
  ('att-0216-006', 'emp-006', '2026-02-16', '2026-02-16 08:20:00', '2026-02-16 17:20:00', 9.00, 1.00, 'NORMAL'),
  ('att-0216-007', 'emp-007', '2026-02-16', '2026-02-16 08:55:00', '2026-02-16 18:10:00', 9.25, 1.25, 'NORMAL'),
  -- 2026-02-17 (화)
  ('att-0217-001', 'emp-001', '2026-02-17', '2026-02-17 08:10:00', '2026-02-17 18:20:00', 10.17, 2.17, 'NORMAL'),
  ('att-0217-002', 'emp-002', '2026-02-17', '2026-02-17 08:40:00', '2026-02-17 17:40:00', 9.00, 1.00, 'NORMAL'),
  ('att-0217-003', 'emp-003', '2026-02-17', '2026-02-17 09:00:00', '2026-02-17 18:45:00', 9.75, 1.75, 'NORMAL'),
  ('att-0217-006', 'emp-006', '2026-02-17', '2026-02-17 08:25:00', '2026-02-17 17:50:00', 9.42, 1.42, 'NORMAL'),
  ('att-0217-007', 'emp-007', '2026-02-17', '2026-02-17 08:35:00', '2026-02-17 17:35:00', 9.00, 1.00, 'NORMAL'),
  -- 2026-02-18 (수)
  ('att-0218-001', 'emp-001', '2026-02-18', '2026-02-18 08:05:00', '2026-02-18 18:15:00', 10.17, 2.17, 'NORMAL'),
  ('att-0218-002', 'emp-002', '2026-02-18', '2026-02-18 08:50:00', '2026-02-18 17:50:00', 9.00, 1.00, 'NORMAL'),
  ('att-0218-003', 'emp-003', '2026-02-18', '2026-02-18 08:30:00', '2026-02-18 19:00:00', 10.50, 2.50, 'NORMAL'),
  ('att-0218-006', 'emp-006', '2026-02-18', '2026-02-18 08:15:00', '2026-02-18 17:30:00', 9.25, 1.25, 'NORMAL'),
  ('att-0218-007', 'emp-007', '2026-02-18', '2026-02-18 09:40:00', '2026-02-18 18:30:00', 8.83, 0.83, 'LATE'),
  -- 2026-02-19 (목 - 오늘)
  ('att-0219-001', 'emp-001', '2026-02-19', '2026-02-19 08:00:00', '2026-02-19 18:00:00', 10.00, 2.00, 'NORMAL'),
  ('att-0219-002', 'emp-002', '2026-02-19', '2026-02-19 08:20:00', '2026-02-19 17:45:00', 9.42, 1.42, 'NORMAL'),
  ('att-0219-003', 'emp-003', '2026-02-19', '2026-02-19 08:45:00', '2026-02-19 18:30:00', 9.75, 1.75, 'NORMAL'),
  ('att-0219-006', 'emp-006', '2026-02-19', '2026-02-19 08:10:00', '2026-02-19 17:40:00', 9.50, 1.50, 'NORMAL'),
  ('att-0219-007', 'emp-007', '2026-02-19', '2026-02-19 08:55:00', '2026-02-19 18:00:00', 9.08, 1.08, 'NORMAL')
ON CONFLICT ("employeeId", "workDate") DO NOTHING;

-- ============================================================
-- 17. 휴가 잔여 (Leave Balance)
-- ============================================================
INSERT INTO "leave_balances" ("id", "employeeId", "year", "totalDays", "usedDays", "remainingDays") VALUES
  ('lb-001', 'emp-001', 2026, 15, 2, 13),
  ('lb-002', 'emp-002', 2026, 15, 3, 12),
  ('lb-003', 'emp-003', 2026, 15, 1, 14),
  ('lb-004', 'emp-004', 2026, 15, 4, 11),
  ('lb-005', 'emp-005', 2026, 15, 0, 15),
  ('lb-006', 'emp-006', 2026, 15, 2, 13),
  ('lb-007', 'emp-007', 2026, 15, 3, 12),
  ('lb-008', 'emp-008', 2026, 15, 1, 14),
  ('lb-009', 'emp-009', 2026, 15, 4, 11),
  ('lb-010', 'emp-010', 2026, 15, 2, 13)
ON CONFLICT ("employeeId", "year") DO NOTHING;

-- ============================================================
-- 완료!
-- 로그인 계정:
--   Admin: admin / admin1234
--   Users: parksales, leedev, hanacct, kangstaff / user1234
-- ============================================================
