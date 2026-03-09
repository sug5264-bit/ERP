-- CreateTable
CREATE TABLE "sales_order_details" (
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
CREATE TABLE "deliveries" (
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
    "orderConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "orderConfirmedAt" TIMESTAMP(3),
    "shipmentCompleted" BOOLEAN NOT NULL DEFAULT false,
    "shipmentCompletedAt" TIMESTAMP(3),
    "actualRevenue" DECIMAL(15,2),
    "platformFee" DECIMAL(15,2),
    "revenueNote" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_details" (
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
CREATE TABLE "online_sales_revenues" (
    "id" TEXT NOT NULL,
    "revenueDate" DATE NOT NULL,
    "channel" TEXT NOT NULL,
    "description" TEXT,
    "totalSales" DECIMAL(15,2) NOT NULL,
    "totalFee" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "netRevenue" DECIMAL(15,2) NOT NULL,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "memo" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "online_sales_revenues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_returns" (
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
CREATE TABLE "sales_return_details" (
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
CREATE TABLE "quality_standards" (
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
CREATE TABLE "quality_inspections" (
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
CREATE TABLE "quality_inspection_items" (
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
CREATE TABLE "purchase_requests" (
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
CREATE TABLE "purchase_request_details" (
    "id" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(15,2) NOT NULL,
    "desiredDate" DATE,
    "remark" TEXT,

    CONSTRAINT "purchase_request_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
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
CREATE TABLE "purchase_order_details" (
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
CREATE TABLE "receivings" (
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
CREATE TABLE "receiving_details" (
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
CREATE TABLE "purchase_payments" (
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
CREATE TABLE "projects" (
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
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "role" "ProjectMemberRole" NOT NULL DEFAULT 'MEMBER',

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_tasks" (
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
CREATE TABLE "project_schedules" (
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
CREATE TABLE "approval_templates" (
    "id" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "moduleCode" TEXT NOT NULL,
    "formSchema" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "approval_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_lines" (
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
CREATE TABLE "approval_documents" (
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
CREATE TABLE "approval_steps" (
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
CREATE TABLE "boards" (
    "id" TEXT NOT NULL,
    "boardCode" TEXT NOT NULL,
    "boardName" TEXT NOT NULL,
    "boardType" TEXT NOT NULL DEFAULT 'GENERAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
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
CREATE TABLE "post_comments" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
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

-- CreateTable
CREATE TABLE "oem_contracts" (
    "id" TEXT NOT NULL,
    "contractNo" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "contractName" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" "OemContractStatus" NOT NULL DEFAULT 'DRAFT',
    "minimumOrderQty" DECIMAL(15,2),
    "leadTimeDays" INTEGER,
    "paymentTerms" TEXT,
    "qualityTerms" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oem_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_headers" (
    "id" TEXT NOT NULL,
    "bomCode" TEXT NOT NULL,
    "bomName" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "yieldRate" DECIMAL(8,4) NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bom_headers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_details" (
    "id" TEXT NOT NULL,
    "bomHeaderId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(15,4) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'EA',
    "lossRate" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "remark" TEXT,

    CONSTRAINT "bom_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_plans" (
    "id" TEXT NOT NULL,
    "planNo" TEXT NOT NULL,
    "planDate" DATE NOT NULL,
    "bomHeaderId" TEXT NOT NULL,
    "oemContractId" TEXT,
    "plannedQty" DECIMAL(15,2) NOT NULL,
    "plannedDate" DATE NOT NULL,
    "completionDate" DATE,
    "status" "ProductionPlanStatus" NOT NULL DEFAULT 'PLANNED',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_results" (
    "id" TEXT NOT NULL,
    "resultNo" TEXT NOT NULL,
    "productionPlanId" TEXT NOT NULL,
    "productionDate" DATE NOT NULL,
    "producedQty" DECIMAL(15,2) NOT NULL,
    "defectQty" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "goodQty" DECIMAL(15,2) NOT NULL,
    "lotNo" TEXT,
    "expiryDate" DATE,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_prices" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "minQty" DECIMAL(15,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipper_companies" (
    "id" TEXT NOT NULL,
    "companyCode" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "bizNo" TEXT,
    "ceoName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "contractStart" DATE,
    "contractEnd" DATE,
    "monthlyFee" DECIMAL(15,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipper_companies_pkey" PRIMARY KEY ("id")
);

