-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum (idempotent: DO block with exception handling)
DO $$ BEGIN CREATE TYPE "EmployeeType" AS ENUM ('REGULAR', 'CONTRACT', 'DISPATCH', 'INTERN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'RESIGNED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AttendanceType" AS ENUM ('NORMAL', 'LATE', 'EARLY', 'ABSENT', 'BUSINESS', 'REMOTE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'SICK', 'FAMILY', 'MATERNITY', 'PARENTAL', 'OFFICIAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "LeaveStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "VoucherType" AS ENUM ('RECEIPT', 'PAYMENT', 'TRANSFER', 'PURCHASE', 'SALES'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "VoucherStatus" AS ENUM ('DRAFT', 'APPROVED', 'CONFIRMED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ItemType" AS ENUM ('RAW_MATERIAL', 'PRODUCT', 'GOODS', 'SUBSIDIARY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "TaxType" AS ENUM ('TAXABLE', 'TAX_FREE', 'ZERO_RATE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MovementType" AS ENUM ('INBOUND', 'OUTBOUND', 'TRANSFER', 'ADJUSTMENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PartnerType" AS ENUM ('SALES', 'PURCHASE', 'BOTH'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ORDERED', 'LOST', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "SalesOrderStatus" AS ENUM ('ORDERED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "SalesChannel" AS ENUM ('ONLINE', 'OFFLINE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ReturnReason" AS ENUM ('DEFECT', 'WRONG_ITEM', 'CUSTOMER_CHANGE', 'QUALITY_ISSUE', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "QualityGrade" AS ENUM ('A', 'B', 'C', 'REJECT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "InspectionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ProjectMemberRole" AS ENUM ('PM', 'MEMBER', 'REVIEWER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "TaskPriority" AS ENUM ('URGENT', 'HIGH', 'NORMAL', 'LOW'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "TaskStatus" AS ENUM ('WAITING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFTED', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "employeeId" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "permissions" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_roles" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "common_codes" (
    "id" TEXT NOT NULL,
    "groupCode" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameKo" TEXT NOT NULL,
    "nameEn" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,
    "extra" JSONB,

    CONSTRAINT "common_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "attachments" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "relatedTable" TEXT NOT NULL,
    "relatedId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "relatedUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "document_sequences" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "companies" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "bizNo" TEXT,
    "ceoName" TEXT,
    "bizType" TEXT,
    "bizCategory" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "fax" TEXT,
    "email" TEXT,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "bankHolder" TEXT,
    "bankCopyPath" TEXT,
    "bizCertPath" TEXT,
    "logoPath" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "departments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "managerId" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "positions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "employees" (
    "id" TEXT NOT NULL,
    "employeeNo" TEXT NOT NULL,
    "nameKo" TEXT NOT NULL,
    "nameEn" TEXT,
    "departmentId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "joinDate" TIMESTAMP(3) NOT NULL,
    "resignDate" TIMESTAMP(3),
    "employeeType" "EmployeeType" NOT NULL DEFAULT 'REGULAR',
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "birthDate" TIMESTAMP(3),
    "gender" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "profileImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "employee_histories" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "fromDept" TEXT,
    "toDept" TEXT,
    "fromPosition" TEXT,
    "toPosition" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "payroll_headers" (
    "id" TEXT NOT NULL,
    "payPeriod" TEXT NOT NULL,
    "payDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_headers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "payroll_details" (
    "id" TEXT NOT NULL,
    "payrollHeaderId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "baseSalary" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "overtimePay" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "bonusPay" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "mealAllowance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "transportAllowance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "nationalPension" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "healthInsurance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "longTermCare" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "employmentInsurance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "incomeTax" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "localIncomeTax" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalEarnings" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "netPay" DECIMAL(15,2) NOT NULL DEFAULT 0,

    CONSTRAINT "payroll_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "attendances" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "checkInTime" TIMESTAMP(3),
    "checkOutTime" TIMESTAMP(3),
    "workHours" DECIMAL(4,2),
    "overtimeHours" DECIMAL(4,2),
    "attendanceType" "AttendanceType" NOT NULL DEFAULT 'NORMAL',
    "note" TEXT,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "leaves" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "days" DECIMAL(4,1) NOT NULL,
    "reason" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'REQUESTED',
    "approvalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "leave_balances" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "totalDays" DECIMAL(4,1) NOT NULL,
    "usedDays" DECIMAL(4,1) NOT NULL DEFAULT 0,
    "remainingDays" DECIMAL(4,1) NOT NULL,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "recruitments" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "description" TEXT,
    "requiredCount" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recruitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "applicants" (
    "id" TEXT NOT NULL,
    "recruitmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "resumePath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applicants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "fiscal_years" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "fiscal_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "account_subjects" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameKo" TEXT NOT NULL,
    "nameEn" TEXT,
    "accountType" "AccountType" NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "taxRelated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "account_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vouchers" (
    "id" TEXT NOT NULL,
    "voucherNo" TEXT NOT NULL,
    "voucherDate" DATE NOT NULL,
    "voucherType" "VoucherType" NOT NULL,
    "description" TEXT,
    "totalDebit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalCredit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" "VoucherStatus" NOT NULL DEFAULT 'DRAFT',
    "fiscalYearId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voucher_details" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "accountSubjectId" TEXT NOT NULL,
    "debitAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "creditAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "partnerId" TEXT,
    "description" TEXT,
    "costCenterId" TEXT,

    CONSTRAINT "voucher_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "tax_invoices" (
    "id" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "issueDate" DATE NOT NULL,
    "invoiceType" TEXT NOT NULL,
    "supplierBizNo" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "supplierCeo" TEXT,
    "supplierAddress" TEXT,
    "supplierBizType" TEXT,
    "supplierBizCategory" TEXT,
    "buyerBizNo" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "buyerCeo" TEXT,
    "buyerAddress" TEXT,
    "buyerBizType" TEXT,
    "buyerBizCategory" TEXT,
    "supplyAmount" DECIMAL(15,2) NOT NULL,
    "taxAmount" DECIMAL(15,2) NOT NULL,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "transmissionStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "ntsConfirmNo" TEXT,
    "voucherId" TEXT,
    "partnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "tax_invoice_items" (
    "id" TEXT NOT NULL,
    "taxInvoiceId" TEXT NOT NULL,
    "itemDate" DATE NOT NULL,
    "itemName" TEXT NOT NULL,
    "specification" TEXT,
    "qty" DECIMAL(10,2) NOT NULL,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "supplyAmount" DECIMAL(15,2) NOT NULL,
    "taxAmount" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "tax_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "cost_centers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "budget_headers" (
    "id" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "budget_headers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "budget_details" (
    "id" TEXT NOT NULL,
    "budgetHeaderId" TEXT NOT NULL,
    "accountSubjectId" TEXT NOT NULL,
    "month01" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "month02" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "month03" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "month04" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "month05" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "month06" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "month07" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "month08" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "month09" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "month10" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "month11" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "month12" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,

    CONSTRAINT "budget_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "item_categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "item_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "items" (
    "id" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "specification" TEXT,
    "categoryId" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'EA',
    "standardPrice" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "safetyStock" INTEGER NOT NULL DEFAULT 0,
    "itemType" "ItemType" NOT NULL DEFAULT 'GOODS',
    "taxType" "TaxType" NOT NULL DEFAULT 'TAXABLE',
    "barcode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "warehouses" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "managerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "warehouse_zones" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "zoneCode" TEXT NOT NULL,
    "zoneName" TEXT NOT NULL,

    CONSTRAINT "warehouse_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "stock_movements" (
    "id" TEXT NOT NULL,
    "movementNo" TEXT NOT NULL,
    "movementDate" DATE NOT NULL,
    "movementType" "MovementType" NOT NULL,
    "sourceWarehouseId" TEXT,
    "targetWarehouseId" TEXT,
    "relatedDocType" TEXT,
    "relatedDocId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "stock_movement_details" (
    "id" TEXT NOT NULL,
    "stockMovementId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(15,2) NOT NULL,
    "unitPrice" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "lotNo" TEXT,
    "expiryDate" DATE,

    CONSTRAINT "stock_movement_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "stock_balances" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "zoneId" TEXT,
    "quantity" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "averageCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "lastMovementDate" TIMESTAMP(3),

    CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "partners" (
    "id" TEXT NOT NULL,
    "partnerCode" TEXT NOT NULL,
    "partnerName" TEXT NOT NULL,
    "partnerType" "PartnerType" NOT NULL DEFAULT 'BOTH',
    "salesChannel" "SalesChannel" NOT NULL DEFAULT 'OFFLINE',
    "bizNo" TEXT,
    "ceoName" TEXT,
    "bizType" TEXT,
    "bizCategory" TEXT,
    "phone" TEXT,
    "fax" TEXT,
    "email" TEXT,
    "address" TEXT,
    "contactPerson" TEXT,
    "creditLimit" DECIMAL(15,2),
    "paymentTerms" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "quotations" (
    "id" TEXT NOT NULL,
    "quotationNo" TEXT NOT NULL,
    "quotationDate" DATE NOT NULL,
    "partnerId" TEXT NOT NULL,
    "validUntil" DATE,
    "totalSupply" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalTax" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "employeeId" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "quotation_details" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(15,2) NOT NULL,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "supplyAmount" DECIMAL(15,2) NOT NULL,
    "taxAmount" DECIMAL(15,2) NOT NULL,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "remark" TEXT,

    CONSTRAINT "quotation_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "sales_orders" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "orderDate" DATE NOT NULL,
    "partnerId" TEXT,
    "quotationId" TEXT,
    "deliveryDate" DATE,
    "salesChannel" "SalesChannel" NOT NULL DEFAULT 'OFFLINE',
    "totalSupply" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalTax" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'ORDERED',
    "employeeId" TEXT NOT NULL,
    "description" TEXT,
    "vatIncluded" BOOLEAN NOT NULL DEFAULT true,
    "dispatchInfo" TEXT,
    "receivedBy" TEXT,
    "siteName" TEXT,
    "ordererName" TEXT,
    "recipientName" TEXT,
    "ordererContact" TEXT,
    "recipientContact" TEXT,
    "recipientZipCode" TEXT,
    "recipientAddress" TEXT,
    "requirements" TEXT,
    "senderName" TEXT,
    "senderPhone" TEXT,
    "senderAddress" TEXT,
    "shippingCost" DECIMAL(15,2),
    "trackingNo" TEXT,
    "specialNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "sales_order_details" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(15,2) NOT NULL,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "supplyAmount" DECIMAL(15,2) NOT NULL,
    "taxAmount" DECIMAL(15,2) NOT NULL,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "deliveredQty" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "remainingQty" DECIMAL(15,2) NOT NULL,
    "remark" TEXT,

    CONSTRAINT "sales_order_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "deliveries" (
    "id" TEXT NOT NULL,
    "deliveryNo" TEXT NOT NULL,
    "deliveryDate" DATE NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREPARING',
    "deliveryAddress" TEXT,
    "trackingNo" TEXT,
    "carrier" TEXT,
    "qualityStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "delivery_details" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(15,2) NOT NULL,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "stockMovementId" TEXT,

    CONSTRAINT "delivery_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "notes" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "relatedTable" TEXT NOT NULL,
    "relatedId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "sales_returns" (
    "id" TEXT NOT NULL,
    "returnNo" TEXT NOT NULL,
    "returnDate" DATE NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "reason" "ReturnReason" NOT NULL DEFAULT 'OTHER',
    "reasonDetail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "totalAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "processedBy" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "sales_return_details" (
    "id" TEXT NOT NULL,
    "salesReturnId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(15,2) NOT NULL,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "remark" TEXT,

    CONSTRAINT "sales_return_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "quality_standards" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "standardName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "checkMethod" TEXT,
    "spec" TEXT,
    "minValue" DECIMAL(15,4),
    "maxValue" DECIMAL(15,4),
    "unit" TEXT,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quality_standards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "quality_inspections" (
    "id" TEXT NOT NULL,
    "inspectionNo" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "inspectionDate" DATE NOT NULL,
    "inspectorName" TEXT NOT NULL,
    "overallGrade" "QualityGrade" NOT NULL DEFAULT 'A',
    "status" "InspectionStatus" NOT NULL DEFAULT 'PENDING',
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "defectCount" INTEGER NOT NULL DEFAULT 0,
    "defectRate" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "lotNo" TEXT,
    "judgement" TEXT NOT NULL DEFAULT 'PASS',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quality_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "quality_inspection_items" (
    "id" TEXT NOT NULL,
    "qualityInspectionId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "checkItem" TEXT NOT NULL,
    "spec" TEXT,
    "measuredValue" TEXT,
    "result" TEXT NOT NULL DEFAULT 'PASS',
    "grade" "QualityGrade" NOT NULL DEFAULT 'A',
    "defectType" TEXT,
    "remarks" TEXT,

    CONSTRAINT "quality_inspection_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "purchase_requests" (
    "id" TEXT NOT NULL,
    "requestNo" TEXT NOT NULL,
    "requestDate" DATE NOT NULL,
    "departmentId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "approvalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "purchase_request_details" (
    "id" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(15,2) NOT NULL,
    "desiredDate" DATE,
    "remark" TEXT,

    CONSTRAINT "purchase_request_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "purchase_orders" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "orderDate" DATE NOT NULL,
    "partnerId" TEXT NOT NULL,
    "purchaseRequestId" TEXT,
    "deliveryDate" DATE,
    "totalSupply" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalTax" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ORDERED',
    "employeeId" TEXT NOT NULL,
    "description" TEXT,
    "dispatchInfo" TEXT,
    "receivedBy" TEXT,
    "vatIncluded" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "purchase_order_details" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(15,2) NOT NULL,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "supplyAmount" DECIMAL(15,2) NOT NULL,
    "taxAmount" DECIMAL(15,2) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "receivedQty" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "remainingQty" DECIMAL(15,2) NOT NULL,
    "remark" TEXT,

    CONSTRAINT "purchase_order_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "receivings" (
    "id" TEXT NOT NULL,
    "receivingNo" TEXT NOT NULL,
    "receivingDate" DATE NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "inspectedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receivings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "receiving_details" (
    "id" TEXT NOT NULL,
    "receivingId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "orderedQty" DECIMAL(15,2) NOT NULL,
    "receivedQty" DECIMAL(15,2) NOT NULL,
    "acceptedQty" DECIMAL(15,2) NOT NULL,
    "rejectedQty" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "stockMovementId" TEXT,

    CONSTRAINT "receiving_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "purchase_payments" (
    "id" TEXT NOT NULL,
    "paymentNo" TEXT NOT NULL,
    "paymentDate" DATE NOT NULL,
    "partnerId" TEXT NOT NULL,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "paymentMethod" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "voucherId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "projects" (
    "id" TEXT NOT NULL,
    "projectCode" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "budget" DECIMAL(15,2),
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "progress" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "project_members" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "role" "ProjectMemberRole" NOT NULL DEFAULT 'MEMBER',

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "project_tasks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskName" TEXT NOT NULL,
    "assigneeId" TEXT,
    "parentTaskId" TEXT,
    "startDate" DATE,
    "endDate" DATE,
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "TaskStatus" NOT NULL DEFAULT 'WAITING',
    "progress" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "estimatedHours" DECIMAL(8,2),
    "actualHours" DECIMAL(8,2),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "project_schedules" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SCHEDULE',
    "description" TEXT,

    CONSTRAINT "project_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "approval_templates" (
    "id" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "moduleCode" TEXT NOT NULL,
    "formSchema" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "approval_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "approval_lines" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "lineOrder" INTEGER NOT NULL,
    "approverType" TEXT NOT NULL,
    "approverId" TEXT,
    "approverPosition" TEXT,
    "approvalType" TEXT NOT NULL DEFAULT 'APPROVE',

    CONSTRAINT "approval_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "approval_documents" (
    "id" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "templateId" TEXT,
    "title" TEXT NOT NULL,
    "content" JSONB,
    "drafterId" TEXT NOT NULL,
    "draftDate" DATE NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "totalSteps" INTEGER NOT NULL DEFAULT 0,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFTED',
    "relatedModule" TEXT,
    "relatedDocId" TEXT,
    "urgency" TEXT NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "approval_steps" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "approverId" TEXT NOT NULL,
    "approvalType" TEXT NOT NULL DEFAULT 'APPROVE',
    "status" "StepStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "actionDate" TIMESTAMP(3),

    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "boards" (
    "id" TEXT NOT NULL,
    "boardCode" TEXT NOT NULL,
    "boardName" TEXT NOT NULL,
    "boardType" TEXT NOT NULL DEFAULT 'GENERAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "posts" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "post_comments" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "messages" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_employeeId_key" ON "users"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "permissions_module_action_key" ON "permissions"("module", "action");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "common_codes_groupCode_idx" ON "common_codes"("groupCode");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "common_codes_groupCode_code_key" ON "common_codes"("groupCode", "code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_tableName_recordId_idx" ON "audit_logs"("tableName", "recordId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_userId_action_idx" ON "audit_logs"("userId", "action");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "attachments_relatedTable_relatedId_idx" ON "attachments"("relatedTable", "relatedId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "document_sequences_prefix_yearMonth_key" ON "document_sequences"("prefix", "yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "companies_bizNo_key" ON "companies"("bizNo");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "positions_code_key" ON "positions"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "employees_employeeNo_key" ON "employees"("employeeNo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "employees_departmentId_idx" ON "employees"("departmentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "employees_status_idx" ON "employees"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "employees_positionId_idx" ON "employees"("positionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "employees_nameKo_idx" ON "employees"("nameKo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "employees_email_idx" ON "employees"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "employee_histories_employeeId_idx" ON "employee_histories"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_headers_payPeriod_key" ON "payroll_headers"("payPeriod");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_details_payrollHeaderId_employeeId_key" ON "payroll_details"("payrollHeaderId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "attendances_employeeId_workDate_key" ON "attendances"("employeeId", "workDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "leaves_employeeId_startDate_idx" ON "leaves"("employeeId", "startDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "leaves_status_idx" ON "leaves"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "leave_balances_employeeId_year_key" ON "leave_balances"("employeeId", "year");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "applicants_recruitmentId_idx" ON "applicants"("recruitmentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_years_year_key" ON "fiscal_years"("year");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "account_subjects_code_key" ON "account_subjects"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "vouchers_voucherNo_key" ON "vouchers"("voucherNo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vouchers_voucherDate_idx" ON "vouchers"("voucherDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vouchers_voucherType_idx" ON "vouchers"("voucherType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vouchers_status_voucherDate_idx" ON "vouchers"("status", "voucherDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vouchers_fiscalYearId_idx" ON "vouchers"("fiscalYearId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vouchers_createdById_idx" ON "vouchers"("createdById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voucher_details_voucherId_idx" ON "voucher_details"("voucherId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "voucher_details_accountSubjectId_idx" ON "voucher_details"("accountSubjectId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tax_invoices_invoiceNo_key" ON "tax_invoices"("invoiceNo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tax_invoices_issueDate_idx" ON "tax_invoices"("issueDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tax_invoices_partnerId_idx" ON "tax_invoices"("partnerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tax_invoices_transmissionStatus_idx" ON "tax_invoices"("transmissionStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tax_invoice_items_taxInvoiceId_idx" ON "tax_invoice_items"("taxInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "cost_centers_code_key" ON "cost_centers"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "budget_headers_fiscalYearId_departmentId_key" ON "budget_headers"("fiscalYearId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "budget_details_budgetHeaderId_accountSubjectId_key" ON "budget_details"("budgetHeaderId", "accountSubjectId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "item_categories_code_key" ON "item_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "items_itemCode_key" ON "items"("itemCode");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "items_barcode_key" ON "items"("barcode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "items_itemName_idx" ON "items"("itemName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "items_isActive_itemType_idx" ON "items"("isActive", "itemType");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "warehouses_code_key" ON "warehouses"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "warehouse_zones_warehouseId_zoneCode_key" ON "warehouse_zones"("warehouseId", "zoneCode");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "stock_movements_movementNo_key" ON "stock_movements"("movementNo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stock_movements_movementDate_idx" ON "stock_movements"("movementDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stock_movements_movementType_movementDate_idx" ON "stock_movements"("movementType", "movementDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stock_movement_details_stockMovementId_idx" ON "stock_movement_details"("stockMovementId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stock_movement_details_itemId_idx" ON "stock_movement_details"("itemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stock_balances_itemId_idx" ON "stock_balances"("itemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stock_balances_warehouseId_idx" ON "stock_balances"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "stock_balances_itemId_warehouseId_zoneId_key" ON "stock_balances"("itemId", "warehouseId", "zoneId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "partners_partnerCode_key" ON "partners"("partnerCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "partners_partnerName_idx" ON "partners"("partnerName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "partners_bizNo_idx" ON "partners"("bizNo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "partners_isActive_partnerType_idx" ON "partners"("isActive", "partnerType");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "quotations_quotationNo_key" ON "quotations"("quotationNo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quotations_quotationDate_idx" ON "quotations"("quotationDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quotations_partnerId_idx" ON "quotations"("partnerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quotations_status_idx" ON "quotations"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quotations_employeeId_idx" ON "quotations"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "sales_orders_orderNo_key" ON "sales_orders"("orderNo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sales_orders_orderDate_idx" ON "sales_orders"("orderDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sales_orders_status_idx" ON "sales_orders"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sales_orders_status_salesChannel_idx" ON "sales_orders"("status", "salesChannel");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sales_orders_partnerId_idx" ON "sales_orders"("partnerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sales_orders_status_createdAt_idx" ON "sales_orders"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sales_orders_employeeId_idx" ON "sales_orders"("employeeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sales_orders_orderDate_status_idx" ON "sales_orders"("orderDate", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sales_order_details_salesOrderId_idx" ON "sales_order_details"("salesOrderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sales_order_details_itemId_idx" ON "sales_order_details"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "deliveries_deliveryNo_key" ON "deliveries"("deliveryNo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "deliveries_deliveryDate_idx" ON "deliveries"("deliveryDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "deliveries_salesOrderId_idx" ON "deliveries"("salesOrderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "deliveries_qualityStatus_idx" ON "deliveries"("qualityStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "delivery_details_deliveryId_idx" ON "delivery_details"("deliveryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notes_relatedTable_relatedId_idx" ON "notes"("relatedTable", "relatedId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "sales_returns_returnNo_key" ON "sales_returns"("returnNo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sales_returns_returnDate_idx" ON "sales_returns"("returnDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sales_returns_status_idx" ON "sales_returns"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sales_return_details_salesReturnId_idx" ON "sales_return_details"("salesReturnId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quality_standards_itemId_idx" ON "quality_standards"("itemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quality_standards_category_idx" ON "quality_standards"("category");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "quality_inspections_inspectionNo_key" ON "quality_inspections"("inspectionNo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quality_inspections_deliveryId_idx" ON "quality_inspections"("deliveryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quality_inspections_inspectionDate_idx" ON "quality_inspections"("inspectionDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quality_inspections_overallGrade_idx" ON "quality_inspections"("overallGrade");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quality_inspections_judgement_idx" ON "quality_inspections"("judgement");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quality_inspection_items_qualityInspectionId_idx" ON "quality_inspection_items"("qualityInspectionId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_requests_requestNo_key" ON "purchase_requests"("requestNo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "purchase_requests_requestDate_idx" ON "purchase_requests"("requestDate");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_orderNo_key" ON "purchase_orders"("orderNo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "purchase_orders_orderDate_idx" ON "purchase_orders"("orderDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "purchase_orders_partnerId_idx" ON "purchase_orders"("partnerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "purchase_orders_employeeId_idx" ON "purchase_orders"("employeeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "purchase_order_details_purchaseOrderId_idx" ON "purchase_order_details"("purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "receivings_receivingNo_key" ON "receivings"("receivingNo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "receivings_receivingDate_idx" ON "receivings"("receivingDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "receiving_details_receivingId_idx" ON "receiving_details"("receivingId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_payments_paymentNo_key" ON "purchase_payments"("paymentNo");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "projects_projectCode_key" ON "projects"("projectCode");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "project_members_projectId_employeeId_key" ON "project_members"("projectId", "employeeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_tasks_projectId_idx" ON "project_tasks"("projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_tasks_assigneeId_idx" ON "project_tasks"("assigneeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_tasks_status_idx" ON "project_tasks"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "approval_lines_templateId_idx" ON "approval_lines"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "approval_documents_documentNo_key" ON "approval_documents"("documentNo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "approval_documents_status_idx" ON "approval_documents"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "approval_documents_drafterId_idx" ON "approval_documents"("drafterId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "approval_documents_createdAt_idx" ON "approval_documents"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "approval_documents_status_createdAt_idx" ON "approval_documents"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "approval_steps_approverId_status_idx" ON "approval_steps"("approverId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "approval_steps_documentId_stepOrder_idx" ON "approval_steps"("documentId", "stepOrder");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "boards_boardCode_key" ON "boards"("boardCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "posts_boardId_createdAt_idx" ON "posts"("boardId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "posts_authorId_idx" ON "posts"("authorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "post_comments_postId_idx" ON "post_comments"("postId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "messages_receiverId_isRead_idx" ON "messages"("receiverId", "isRead");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "messages_senderId_sentAt_idx" ON "messages"("senderId", "sentAt");

-- AddForeignKey (idempotent: DROP IF EXISTS before ADD)
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_employeeId_fkey";
ALTER TABLE "users" ADD CONSTRAINT "users_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "role_permissions_roleId_fkey";
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "role_permissions_permissionId_fkey";
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_roles" DROP CONSTRAINT IF EXISTS "user_roles_userId_fkey";
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_roles" DROP CONSTRAINT IF EXISTS "user_roles_roleId_fkey";
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "common_codes" DROP CONSTRAINT IF EXISTS "common_codes_parentId_fkey";
ALTER TABLE "common_codes" ADD CONSTRAINT "common_codes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "common_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_userId_fkey";
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_userId_fkey";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "departments" DROP CONSTRAINT IF EXISTS "departments_parentId_fkey";
ALTER TABLE "departments" ADD CONSTRAINT "departments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "employees_departmentId_fkey";
ALTER TABLE "employees" ADD CONSTRAINT "employees_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "employees_positionId_fkey";
ALTER TABLE "employees" ADD CONSTRAINT "employees_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_histories" DROP CONSTRAINT IF EXISTS "employee_histories_employeeId_fkey";
ALTER TABLE "employee_histories" ADD CONSTRAINT "employee_histories_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payroll_details" DROP CONSTRAINT IF EXISTS "payroll_details_payrollHeaderId_fkey";
ALTER TABLE "payroll_details" ADD CONSTRAINT "payroll_details_payrollHeaderId_fkey" FOREIGN KEY ("payrollHeaderId") REFERENCES "payroll_headers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payroll_details" DROP CONSTRAINT IF EXISTS "payroll_details_employeeId_fkey";
ALTER TABLE "payroll_details" ADD CONSTRAINT "payroll_details_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendances" DROP CONSTRAINT IF EXISTS "attendances_employeeId_fkey";
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leaves" DROP CONSTRAINT IF EXISTS "leaves_employeeId_fkey";
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leave_balances" DROP CONSTRAINT IF EXISTS "leave_balances_employeeId_fkey";
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "applicants" DROP CONSTRAINT IF EXISTS "applicants_recruitmentId_fkey";
ALTER TABLE "applicants" ADD CONSTRAINT "applicants_recruitmentId_fkey" FOREIGN KEY ("recruitmentId") REFERENCES "recruitments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "account_subjects" DROP CONSTRAINT IF EXISTS "account_subjects_parentId_fkey";
ALTER TABLE "account_subjects" ADD CONSTRAINT "account_subjects_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "account_subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vouchers" DROP CONSTRAINT IF EXISTS "vouchers_fiscalYearId_fkey";
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vouchers" DROP CONSTRAINT IF EXISTS "vouchers_createdById_fkey";
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vouchers" DROP CONSTRAINT IF EXISTS "vouchers_approvedById_fkey";
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "voucher_details" DROP CONSTRAINT IF EXISTS "voucher_details_voucherId_fkey";
ALTER TABLE "voucher_details" ADD CONSTRAINT "voucher_details_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "voucher_details" DROP CONSTRAINT IF EXISTS "voucher_details_accountSubjectId_fkey";
ALTER TABLE "voucher_details" ADD CONSTRAINT "voucher_details_accountSubjectId_fkey" FOREIGN KEY ("accountSubjectId") REFERENCES "account_subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "voucher_details" DROP CONSTRAINT IF EXISTS "voucher_details_partnerId_fkey";
ALTER TABLE "voucher_details" ADD CONSTRAINT "voucher_details_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "voucher_details" DROP CONSTRAINT IF EXISTS "voucher_details_costCenterId_fkey";
ALTER TABLE "voucher_details" ADD CONSTRAINT "voucher_details_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tax_invoices" DROP CONSTRAINT IF EXISTS "tax_invoices_voucherId_fkey";
ALTER TABLE "tax_invoices" ADD CONSTRAINT "tax_invoices_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tax_invoices" DROP CONSTRAINT IF EXISTS "tax_invoices_partnerId_fkey";
ALTER TABLE "tax_invoices" ADD CONSTRAINT "tax_invoices_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tax_invoice_items" DROP CONSTRAINT IF EXISTS "tax_invoice_items_taxInvoiceId_fkey";
ALTER TABLE "tax_invoice_items" ADD CONSTRAINT "tax_invoice_items_taxInvoiceId_fkey" FOREIGN KEY ("taxInvoiceId") REFERENCES "tax_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cost_centers" DROP CONSTRAINT IF EXISTS "cost_centers_departmentId_fkey";
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "budget_headers" DROP CONSTRAINT IF EXISTS "budget_headers_fiscalYearId_fkey";
ALTER TABLE "budget_headers" ADD CONSTRAINT "budget_headers_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "budget_headers" DROP CONSTRAINT IF EXISTS "budget_headers_departmentId_fkey";
ALTER TABLE "budget_headers" ADD CONSTRAINT "budget_headers_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "budget_details" DROP CONSTRAINT IF EXISTS "budget_details_budgetHeaderId_fkey";
ALTER TABLE "budget_details" ADD CONSTRAINT "budget_details_budgetHeaderId_fkey" FOREIGN KEY ("budgetHeaderId") REFERENCES "budget_headers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "budget_details" DROP CONSTRAINT IF EXISTS "budget_details_accountSubjectId_fkey";
ALTER TABLE "budget_details" ADD CONSTRAINT "budget_details_accountSubjectId_fkey" FOREIGN KEY ("accountSubjectId") REFERENCES "account_subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "item_categories" DROP CONSTRAINT IF EXISTS "item_categories_parentId_fkey";
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "item_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "items" DROP CONSTRAINT IF EXISTS "items_categoryId_fkey";
ALTER TABLE "items" ADD CONSTRAINT "items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "item_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "warehouse_zones" DROP CONSTRAINT IF EXISTS "warehouse_zones_warehouseId_fkey";
ALTER TABLE "warehouse_zones" ADD CONSTRAINT "warehouse_zones_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_movements" DROP CONSTRAINT IF EXISTS "stock_movements_sourceWarehouseId_fkey";
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_movements" DROP CONSTRAINT IF EXISTS "stock_movements_targetWarehouseId_fkey";
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_targetWarehouseId_fkey" FOREIGN KEY ("targetWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_movement_details" DROP CONSTRAINT IF EXISTS "stock_movement_details_stockMovementId_fkey";
ALTER TABLE "stock_movement_details" ADD CONSTRAINT "stock_movement_details_stockMovementId_fkey" FOREIGN KEY ("stockMovementId") REFERENCES "stock_movements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_movement_details" DROP CONSTRAINT IF EXISTS "stock_movement_details_itemId_fkey";
ALTER TABLE "stock_movement_details" ADD CONSTRAINT "stock_movement_details_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_balances" DROP CONSTRAINT IF EXISTS "stock_balances_itemId_fkey";
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_balances" DROP CONSTRAINT IF EXISTS "stock_balances_warehouseId_fkey";
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_balances" DROP CONSTRAINT IF EXISTS "stock_balances_zoneId_fkey";
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "warehouse_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "quotations" DROP CONSTRAINT IF EXISTS "quotations_partnerId_fkey";
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "quotations" DROP CONSTRAINT IF EXISTS "quotations_employeeId_fkey";
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "quotation_details" DROP CONSTRAINT IF EXISTS "quotation_details_quotationId_fkey";
ALTER TABLE "quotation_details" ADD CONSTRAINT "quotation_details_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "quotation_details" DROP CONSTRAINT IF EXISTS "quotation_details_itemId_fkey";
ALTER TABLE "quotation_details" ADD CONSTRAINT "quotation_details_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_orders" DROP CONSTRAINT IF EXISTS "sales_orders_partnerId_fkey";
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sales_orders" DROP CONSTRAINT IF EXISTS "sales_orders_quotationId_fkey";
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sales_orders" DROP CONSTRAINT IF EXISTS "sales_orders_employeeId_fkey";
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_order_details" DROP CONSTRAINT IF EXISTS "sales_order_details_salesOrderId_fkey";
ALTER TABLE "sales_order_details" ADD CONSTRAINT "sales_order_details_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sales_order_details" DROP CONSTRAINT IF EXISTS "sales_order_details_itemId_fkey";
ALTER TABLE "sales_order_details" ADD CONSTRAINT "sales_order_details_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "deliveries" DROP CONSTRAINT IF EXISTS "deliveries_salesOrderId_fkey";
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "deliveries" DROP CONSTRAINT IF EXISTS "deliveries_partnerId_fkey";
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "delivery_details" DROP CONSTRAINT IF EXISTS "delivery_details_deliveryId_fkey";
ALTER TABLE "delivery_details" ADD CONSTRAINT "delivery_details_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "delivery_details" DROP CONSTRAINT IF EXISTS "delivery_details_itemId_fkey";
ALTER TABLE "delivery_details" ADD CONSTRAINT "delivery_details_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_requests" DROP CONSTRAINT IF EXISTS "purchase_requests_departmentId_fkey";
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_request_details" DROP CONSTRAINT IF EXISTS "purchase_request_details_purchaseRequestId_fkey";
ALTER TABLE "purchase_request_details" ADD CONSTRAINT "purchase_request_details_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "purchase_request_details" DROP CONSTRAINT IF EXISTS "purchase_request_details_itemId_fkey";
ALTER TABLE "purchase_request_details" ADD CONSTRAINT "purchase_request_details_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_orders" DROP CONSTRAINT IF EXISTS "purchase_orders_partnerId_fkey";
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_orders" DROP CONSTRAINT IF EXISTS "purchase_orders_employeeId_fkey";
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_order_details" DROP CONSTRAINT IF EXISTS "purchase_order_details_purchaseOrderId_fkey";
ALTER TABLE "purchase_order_details" ADD CONSTRAINT "purchase_order_details_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "purchase_order_details" DROP CONSTRAINT IF EXISTS "purchase_order_details_itemId_fkey";
ALTER TABLE "purchase_order_details" ADD CONSTRAINT "purchase_order_details_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "receivings" DROP CONSTRAINT IF EXISTS "receivings_purchaseOrderId_fkey";
ALTER TABLE "receivings" ADD CONSTRAINT "receivings_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "receivings" DROP CONSTRAINT IF EXISTS "receivings_partnerId_fkey";
ALTER TABLE "receivings" ADD CONSTRAINT "receivings_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "receiving_details" DROP CONSTRAINT IF EXISTS "receiving_details_receivingId_fkey";
ALTER TABLE "receiving_details" ADD CONSTRAINT "receiving_details_receivingId_fkey" FOREIGN KEY ("receivingId") REFERENCES "receivings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "receiving_details" DROP CONSTRAINT IF EXISTS "receiving_details_itemId_fkey";
ALTER TABLE "receiving_details" ADD CONSTRAINT "receiving_details_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_payments" DROP CONSTRAINT IF EXISTS "purchase_payments_partnerId_fkey";
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_departmentId_fkey";
ALTER TABLE "projects" ADD CONSTRAINT "projects_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_members" DROP CONSTRAINT IF EXISTS "project_members_projectId_fkey";
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_members" DROP CONSTRAINT IF EXISTS "project_members_employeeId_fkey";
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_tasks" DROP CONSTRAINT IF EXISTS "project_tasks_projectId_fkey";
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_tasks" DROP CONSTRAINT IF EXISTS "project_tasks_parentTaskId_fkey";
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "project_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_schedules" DROP CONSTRAINT IF EXISTS "project_schedules_projectId_fkey";
ALTER TABLE "project_schedules" ADD CONSTRAINT "project_schedules_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_lines" DROP CONSTRAINT IF EXISTS "approval_lines_templateId_fkey";
ALTER TABLE "approval_lines" ADD CONSTRAINT "approval_lines_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "approval_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_documents" DROP CONSTRAINT IF EXISTS "approval_documents_templateId_fkey";
ALTER TABLE "approval_documents" ADD CONSTRAINT "approval_documents_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "approval_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "approval_documents" DROP CONSTRAINT IF EXISTS "approval_documents_drafterId_fkey";
ALTER TABLE "approval_documents" ADD CONSTRAINT "approval_documents_drafterId_fkey" FOREIGN KEY ("drafterId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "approval_steps" DROP CONSTRAINT IF EXISTS "approval_steps_documentId_fkey";
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "approval_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_steps" DROP CONSTRAINT IF EXISTS "approval_steps_approverId_fkey";
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_boardId_fkey";
ALTER TABLE "posts" ADD CONSTRAINT "posts_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "boards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_authorId_fkey";
ALTER TABLE "posts" ADD CONSTRAINT "posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "post_comments" DROP CONSTRAINT IF EXISTS "post_comments_postId_fkey";
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "post_comments" DROP CONSTRAINT IF EXISTS "post_comments_authorId_fkey";
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "post_comments" DROP CONSTRAINT IF EXISTS "post_comments_parentCommentId_fkey";
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "post_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_senderId_fkey";
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_receiverId_fkey";
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_returns" DROP CONSTRAINT IF EXISTS "sales_returns_salesOrderId_fkey";
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_returns" DROP CONSTRAINT IF EXISTS "sales_returns_partnerId_fkey";
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_return_details" DROP CONSTRAINT IF EXISTS "sales_return_details_salesReturnId_fkey";
ALTER TABLE "sales_return_details" ADD CONSTRAINT "sales_return_details_salesReturnId_fkey" FOREIGN KEY ("salesReturnId") REFERENCES "sales_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sales_return_details" DROP CONSTRAINT IF EXISTS "sales_return_details_itemId_fkey";
ALTER TABLE "sales_return_details" ADD CONSTRAINT "sales_return_details_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "quality_standards" DROP CONSTRAINT IF EXISTS "quality_standards_itemId_fkey";
ALTER TABLE "quality_standards" ADD CONSTRAINT "quality_standards_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "quality_inspections" DROP CONSTRAINT IF EXISTS "quality_inspections_deliveryId_fkey";
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "quality_inspection_items" DROP CONSTRAINT IF EXISTS "quality_inspection_items_qualityInspectionId_fkey";
ALTER TABLE "quality_inspection_items" ADD CONSTRAINT "quality_inspection_items_qualityInspectionId_fkey" FOREIGN KEY ("qualityInspectionId") REFERENCES "quality_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;