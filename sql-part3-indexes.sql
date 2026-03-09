-- CreateTable
CREATE TABLE "shipper_orders" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "shipperId" TEXT NOT NULL,
    "orderDate" DATE NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderPhone" TEXT,
    "senderAddress" TEXT,
    "recipientName" TEXT NOT NULL,
    "recipientPhone" TEXT,
    "recipientZipCode" TEXT,
    "recipientAddress" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "weight" DECIMAL(10,2),
    "shippingMethod" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "trackingNo" TEXT,
    "carrier" TEXT,
    "shippingCost" DECIMAL(15,2),
    "deliveredAt" TIMESTAMP(3),
    "specialNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipper_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeId_key" ON "users"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_module_action_key" ON "permissions"("module", "action");

-- CreateIndex
CREATE INDEX "common_codes_groupCode_idx" ON "common_codes"("groupCode");

-- CreateIndex
CREATE UNIQUE INDEX "common_codes_groupCode_code_key" ON "common_codes"("groupCode", "code");

-- CreateIndex
CREATE INDEX "audit_logs_tableName_recordId_idx" ON "audit_logs"("tableName", "recordId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_action_idx" ON "audit_logs"("userId", "action");

-- CreateIndex
CREATE INDEX "attachments_relatedTable_relatedId_idx" ON "attachments"("relatedTable", "relatedId");

-- CreateIndex
CREATE INDEX "notes_relatedTable_relatedId_idx" ON "notes"("relatedTable", "relatedId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "document_sequences_prefix_yearMonth_key" ON "document_sequences"("prefix", "yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "companies_bizNo_key" ON "companies"("bizNo");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "positions_code_key" ON "positions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employeeNo_key" ON "employees"("employeeNo");

-- CreateIndex
CREATE INDEX "employees_departmentId_idx" ON "employees"("departmentId");

-- CreateIndex
CREATE INDEX "employees_status_idx" ON "employees"("status");

-- CreateIndex
CREATE INDEX "employees_positionId_idx" ON "employees"("positionId");

-- CreateIndex
CREATE INDEX "employees_nameKo_idx" ON "employees"("nameKo");

-- CreateIndex
CREATE INDEX "employees_email_idx" ON "employees"("email");

-- CreateIndex
CREATE INDEX "employee_histories_employeeId_idx" ON "employee_histories"("employeeId");

-- CreateIndex
CREATE INDEX "employee_histories_employeeId_effectiveDate_idx" ON "employee_histories"("employeeId", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_headers_payPeriod_key" ON "payroll_headers"("payPeriod");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_details_payrollHeaderId_employeeId_key" ON "payroll_details"("payrollHeaderId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_employeeId_workDate_key" ON "attendances"("employeeId", "workDate");

-- CreateIndex
CREATE INDEX "leaves_employeeId_startDate_idx" ON "leaves"("employeeId", "startDate");

-- CreateIndex
CREATE INDEX "leaves_status_idx" ON "leaves"("status");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_employeeId_year_key" ON "leave_balances"("employeeId", "year");

-- CreateIndex
CREATE INDEX "recruitments_status_idx" ON "recruitments"("status");

-- CreateIndex
CREATE INDEX "recruitments_departmentId_idx" ON "recruitments"("departmentId");

-- CreateIndex
CREATE INDEX "recruitments_startDate_endDate_idx" ON "recruitments"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "applicants_recruitmentId_idx" ON "applicants"("recruitmentId");

-- CreateIndex
CREATE INDEX "applicants_status_idx" ON "applicants"("status");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_years_year_key" ON "fiscal_years"("year");

-- CreateIndex
CREATE UNIQUE INDEX "account_subjects_code_key" ON "account_subjects"("code");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_voucherNo_key" ON "vouchers"("voucherNo");

-- CreateIndex
CREATE INDEX "vouchers_voucherDate_idx" ON "vouchers"("voucherDate");

-- CreateIndex
CREATE INDEX "vouchers_voucherType_idx" ON "vouchers"("voucherType");

-- CreateIndex
CREATE INDEX "vouchers_status_voucherDate_idx" ON "vouchers"("status", "voucherDate");

-- CreateIndex
CREATE INDEX "vouchers_fiscalYearId_idx" ON "vouchers"("fiscalYearId");

-- CreateIndex
CREATE INDEX "vouchers_createdById_idx" ON "vouchers"("createdById");

-- CreateIndex
CREATE INDEX "voucher_details_voucherId_idx" ON "voucher_details"("voucherId");

-- CreateIndex
CREATE INDEX "voucher_details_accountSubjectId_idx" ON "voucher_details"("accountSubjectId");

-- CreateIndex
CREATE INDEX "voucher_details_partnerId_idx" ON "voucher_details"("partnerId");

-- CreateIndex
CREATE INDEX "voucher_details_costCenterId_idx" ON "voucher_details"("costCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "tax_invoices_invoiceNo_key" ON "tax_invoices"("invoiceNo");

-- CreateIndex
CREATE INDEX "tax_invoices_issueDate_idx" ON "tax_invoices"("issueDate");

-- CreateIndex
CREATE INDEX "tax_invoices_partnerId_idx" ON "tax_invoices"("partnerId");

-- CreateIndex
CREATE INDEX "tax_invoices_transmissionStatus_idx" ON "tax_invoices"("transmissionStatus");

-- CreateIndex
CREATE INDEX "tax_invoice_items_taxInvoiceId_idx" ON "tax_invoice_items"("taxInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "cost_centers_code_key" ON "cost_centers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "budget_headers_fiscalYearId_departmentId_key" ON "budget_headers"("fiscalYearId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "budget_details_budgetHeaderId_accountSubjectId_key" ON "budget_details"("budgetHeaderId", "accountSubjectId");

-- CreateIndex
CREATE UNIQUE INDEX "item_categories_code_key" ON "item_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "items_itemCode_key" ON "items"("itemCode");

-- CreateIndex
CREATE UNIQUE INDEX "items_barcode_key" ON "items"("barcode");

-- CreateIndex
CREATE INDEX "items_itemName_idx" ON "items"("itemName");

-- CreateIndex
CREATE INDEX "items_isActive_itemType_idx" ON "items"("isActive", "itemType");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_zones_warehouseId_zoneCode_key" ON "warehouse_zones"("warehouseId", "zoneCode");

-- CreateIndex
CREATE UNIQUE INDEX "stock_movements_movementNo_key" ON "stock_movements"("movementNo");

-- CreateIndex
CREATE INDEX "stock_movements_movementDate_idx" ON "stock_movements"("movementDate");

-- CreateIndex
CREATE INDEX "stock_movements_movementType_movementDate_idx" ON "stock_movements"("movementType", "movementDate");

-- CreateIndex
CREATE INDEX "stock_movement_details_stockMovementId_idx" ON "stock_movement_details"("stockMovementId");

-- CreateIndex
CREATE INDEX "stock_movement_details_itemId_idx" ON "stock_movement_details"("itemId");

-- CreateIndex
CREATE INDEX "stock_balances_itemId_idx" ON "stock_balances"("itemId");

-- CreateIndex
CREATE INDEX "stock_balances_warehouseId_idx" ON "stock_balances"("warehouseId");

-- CreateIndex
CREATE INDEX "stock_balances_expiryDate_idx" ON "stock_balances"("expiryDate");

-- CreateIndex
CREATE INDEX "stock_balances_lotNo_idx" ON "stock_balances"("lotNo");

-- CreateIndex
CREATE UNIQUE INDEX "stock_balances_itemId_warehouseId_zoneId_key" ON "stock_balances"("itemId", "warehouseId", "zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "partners_partnerCode_key" ON "partners"("partnerCode");

-- CreateIndex
CREATE INDEX "partners_partnerName_idx" ON "partners"("partnerName");

-- CreateIndex
CREATE INDEX "partners_bizNo_idx" ON "partners"("bizNo");

-- CreateIndex
CREATE INDEX "partners_isActive_partnerType_idx" ON "partners"("isActive", "partnerType");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_quotationNo_key" ON "quotations"("quotationNo");

-- CreateIndex
CREATE INDEX "quotations_quotationDate_idx" ON "quotations"("quotationDate");

-- CreateIndex
CREATE INDEX "quotations_partnerId_idx" ON "quotations"("partnerId");

-- CreateIndex
CREATE INDEX "quotations_status_idx" ON "quotations"("status");

-- CreateIndex
CREATE INDEX "quotations_employeeId_idx" ON "quotations"("employeeId");

-- CreateIndex
CREATE INDEX "quotation_details_quotationId_idx" ON "quotation_details"("quotationId");

-- CreateIndex
CREATE INDEX "quotation_details_itemId_idx" ON "quotation_details"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_orderNo_key" ON "sales_orders"("orderNo");

-- CreateIndex
CREATE INDEX "sales_orders_orderDate_idx" ON "sales_orders"("orderDate");

-- CreateIndex
CREATE INDEX "sales_orders_status_idx" ON "sales_orders"("status");

-- CreateIndex
CREATE INDEX "sales_orders_status_salesChannel_idx" ON "sales_orders"("status", "salesChannel");

-- CreateIndex
CREATE INDEX "sales_orders_partnerId_idx" ON "sales_orders"("partnerId");

-- CreateIndex
CREATE INDEX "sales_orders_status_createdAt_idx" ON "sales_orders"("status", "createdAt");

-- CreateIndex
CREATE INDEX "sales_orders_employeeId_idx" ON "sales_orders"("employeeId");

-- CreateIndex
CREATE INDEX "sales_orders_orderDate_status_idx" ON "sales_orders"("orderDate", "status");

-- CreateIndex
CREATE INDEX "sales_order_details_salesOrderId_idx" ON "sales_order_details"("salesOrderId");

-- CreateIndex
CREATE INDEX "sales_order_details_itemId_idx" ON "sales_order_details"("itemId");

-- CreateIndex
CREATE INDEX "sales_order_details_itemId_remainingQty_idx" ON "sales_order_details"("itemId", "remainingQty");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_deliveryNo_key" ON "deliveries"("deliveryNo");

-- CreateIndex
CREATE INDEX "deliveries_deliveryDate_idx" ON "deliveries"("deliveryDate");

-- CreateIndex
CREATE INDEX "deliveries_salesOrderId_idx" ON "deliveries"("salesOrderId");

-- CreateIndex
CREATE INDEX "deliveries_partnerId_idx" ON "deliveries"("partnerId");

-- CreateIndex
CREATE INDEX "deliveries_status_idx" ON "deliveries"("status");

-- CreateIndex
CREATE INDEX "deliveries_qualityStatus_idx" ON "deliveries"("qualityStatus");

-- CreateIndex
CREATE INDEX "deliveries_orderConfirmed_idx" ON "deliveries"("orderConfirmed");

-- CreateIndex
CREATE INDEX "deliveries_shipmentCompleted_idx" ON "deliveries"("shipmentCompleted");

-- CreateIndex
CREATE INDEX "delivery_details_deliveryId_idx" ON "delivery_details"("deliveryId");

-- CreateIndex
CREATE INDEX "delivery_details_itemId_idx" ON "delivery_details"("itemId");

-- CreateIndex
CREATE INDEX "online_sales_revenues_revenueDate_idx" ON "online_sales_revenues"("revenueDate");

-- CreateIndex
CREATE INDEX "online_sales_revenues_channel_idx" ON "online_sales_revenues"("channel");

-- CreateIndex
CREATE INDEX "online_sales_revenues_revenueDate_channel_idx" ON "online_sales_revenues"("revenueDate", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "sales_returns_returnNo_key" ON "sales_returns"("returnNo");

-- CreateIndex
CREATE INDEX "sales_returns_returnDate_idx" ON "sales_returns"("returnDate");

-- CreateIndex
CREATE INDEX "sales_returns_status_idx" ON "sales_returns"("status");

-- CreateIndex
CREATE INDEX "sales_return_details_salesReturnId_idx" ON "sales_return_details"("salesReturnId");

-- CreateIndex
CREATE INDEX "sales_return_details_itemId_idx" ON "sales_return_details"("itemId");

-- CreateIndex
CREATE INDEX "quality_standards_itemId_idx" ON "quality_standards"("itemId");

-- CreateIndex
CREATE INDEX "quality_standards_category_idx" ON "quality_standards"("category");

-- CreateIndex
CREATE UNIQUE INDEX "quality_inspections_inspectionNo_key" ON "quality_inspections"("inspectionNo");

-- CreateIndex
CREATE INDEX "quality_inspections_deliveryId_idx" ON "quality_inspections"("deliveryId");

-- CreateIndex
CREATE INDEX "quality_inspections_inspectionDate_idx" ON "quality_inspections"("inspectionDate");

-- CreateIndex
CREATE INDEX "quality_inspections_overallGrade_idx" ON "quality_inspections"("overallGrade");

-- CreateIndex
CREATE INDEX "quality_inspections_judgement_idx" ON "quality_inspections"("judgement");

-- CreateIndex
CREATE INDEX "quality_inspection_items_qualityInspectionId_idx" ON "quality_inspection_items"("qualityInspectionId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requests_requestNo_key" ON "purchase_requests"("requestNo");

-- CreateIndex
CREATE INDEX "purchase_requests_requestDate_idx" ON "purchase_requests"("requestDate");

-- CreateIndex
CREATE INDEX "purchase_requests_status_idx" ON "purchase_requests"("status");

-- CreateIndex
CREATE INDEX "purchase_requests_departmentId_idx" ON "purchase_requests"("departmentId");

-- CreateIndex
CREATE INDEX "purchase_request_details_purchaseRequestId_idx" ON "purchase_request_details"("purchaseRequestId");

-- CreateIndex
CREATE INDEX "purchase_request_details_itemId_idx" ON "purchase_request_details"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_orderNo_key" ON "purchase_orders"("orderNo");

-- CreateIndex
CREATE INDEX "purchase_orders_orderDate_idx" ON "purchase_orders"("orderDate");

-- CreateIndex
CREATE INDEX "purchase_orders_partnerId_idx" ON "purchase_orders"("partnerId");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE INDEX "purchase_orders_employeeId_idx" ON "purchase_orders"("employeeId");

-- CreateIndex
CREATE INDEX "purchase_order_details_purchaseOrderId_idx" ON "purchase_order_details"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "purchase_order_details_itemId_idx" ON "purchase_order_details"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "receivings_receivingNo_key" ON "receivings"("receivingNo");

-- CreateIndex
CREATE INDEX "receivings_receivingDate_idx" ON "receivings"("receivingDate");

-- CreateIndex
CREATE INDEX "receivings_purchaseOrderId_idx" ON "receivings"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "receivings_partnerId_idx" ON "receivings"("partnerId");

-- CreateIndex
CREATE INDEX "receiving_details_receivingId_idx" ON "receiving_details"("receivingId");

-- CreateIndex
CREATE INDEX "receiving_details_itemId_idx" ON "receiving_details"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_payments_paymentNo_key" ON "purchase_payments"("paymentNo");

-- CreateIndex
CREATE INDEX "purchase_payments_partnerId_idx" ON "purchase_payments"("partnerId");

-- CreateIndex
CREATE INDEX "purchase_payments_paymentDate_idx" ON "purchase_payments"("paymentDate");

-- CreateIndex
CREATE INDEX "purchase_payments_status_idx" ON "purchase_payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "projects_projectCode_key" ON "projects"("projectCode");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_projectId_employeeId_key" ON "project_members"("projectId", "employeeId");

-- CreateIndex
CREATE INDEX "project_tasks_projectId_idx" ON "project_tasks"("projectId");

-- CreateIndex
CREATE INDEX "project_tasks_assigneeId_idx" ON "project_tasks"("assigneeId");

-- CreateIndex
CREATE INDEX "project_tasks_status_idx" ON "project_tasks"("status");

-- CreateIndex
CREATE INDEX "approval_lines_templateId_idx" ON "approval_lines"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "approval_documents_documentNo_key" ON "approval_documents"("documentNo");

-- CreateIndex
CREATE INDEX "approval_documents_status_idx" ON "approval_documents"("status");

-- CreateIndex
CREATE INDEX "approval_documents_drafterId_idx" ON "approval_documents"("drafterId");

-- CreateIndex
CREATE INDEX "approval_documents_createdAt_idx" ON "approval_documents"("createdAt");

-- CreateIndex
CREATE INDEX "approval_documents_status_createdAt_idx" ON "approval_documents"("status", "createdAt");

-- CreateIndex
CREATE INDEX "approval_steps_approverId_status_idx" ON "approval_steps"("approverId", "status");

-- CreateIndex
CREATE INDEX "approval_steps_documentId_stepOrder_idx" ON "approval_steps"("documentId", "stepOrder");

-- CreateIndex
CREATE UNIQUE INDEX "boards_boardCode_key" ON "boards"("boardCode");

-- CreateIndex
CREATE INDEX "posts_boardId_createdAt_idx" ON "posts"("boardId", "createdAt");

-- CreateIndex
CREATE INDEX "posts_authorId_idx" ON "posts"("authorId");

-- CreateIndex
CREATE INDEX "post_comments_postId_idx" ON "post_comments"("postId");

-- CreateIndex
CREATE INDEX "messages_receiverId_isRead_idx" ON "messages"("receiverId", "isRead");

-- CreateIndex
CREATE INDEX "messages_senderId_sentAt_idx" ON "messages"("senderId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "oem_contracts_contractNo_key" ON "oem_contracts"("contractNo");

-- CreateIndex
CREATE INDEX "oem_contracts_partnerId_idx" ON "oem_contracts"("partnerId");

-- CreateIndex
CREATE INDEX "oem_contracts_status_idx" ON "oem_contracts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "bom_headers_bomCode_key" ON "bom_headers"("bomCode");

-- CreateIndex
CREATE INDEX "bom_headers_itemId_idx" ON "bom_headers"("itemId");

-- CreateIndex
CREATE INDEX "bom_details_itemId_idx" ON "bom_details"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "bom_details_bomHeaderId_lineNo_key" ON "bom_details"("bomHeaderId", "lineNo");

-- CreateIndex
CREATE UNIQUE INDEX "production_plans_planNo_key" ON "production_plans"("planNo");

-- CreateIndex
CREATE INDEX "production_plans_planDate_idx" ON "production_plans"("planDate");

-- CreateIndex
CREATE INDEX "production_plans_status_idx" ON "production_plans"("status");

-- CreateIndex
CREATE INDEX "production_plans_oemContractId_idx" ON "production_plans"("oemContractId");

-- CreateIndex
CREATE UNIQUE INDEX "production_results_resultNo_key" ON "production_results"("resultNo");

-- CreateIndex
CREATE INDEX "production_results_productionPlanId_idx" ON "production_results"("productionPlanId");

-- CreateIndex
CREATE INDEX "production_results_productionDate_idx" ON "production_results"("productionDate");

-- CreateIndex
CREATE INDEX "production_results_lotNo_idx" ON "production_results"("lotNo");

-- CreateIndex
CREATE INDEX "sales_prices_partnerId_idx" ON "sales_prices"("partnerId");

-- CreateIndex
CREATE INDEX "sales_prices_itemId_idx" ON "sales_prices"("itemId");

-- CreateIndex
CREATE INDEX "sales_prices_isActive_idx" ON "sales_prices"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "sales_prices_partnerId_itemId_startDate_key" ON "sales_prices"("partnerId", "itemId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "shipper_companies_companyCode_key" ON "shipper_companies"("companyCode");

-- CreateIndex
CREATE UNIQUE INDEX "shipper_companies_bizNo_key" ON "shipper_companies"("bizNo");

-- CreateIndex
CREATE INDEX "shipper_companies_companyName_idx" ON "shipper_companies"("companyName");

-- CreateIndex
CREATE UNIQUE INDEX "shipper_orders_orderNo_key" ON "shipper_orders"("orderNo");

-- CreateIndex
CREATE INDEX "shipper_orders_shipperId_idx" ON "shipper_orders"("shipperId");

-- CreateIndex
CREATE INDEX "shipper_orders_orderDate_idx" ON "shipper_orders"("orderDate");

-- CreateIndex
CREATE INDEX "shipper_orders_status_idx" ON "shipper_orders"("status");

-- CreateIndex
CREATE INDEX "shipper_orders_trackingNo_idx" ON "shipper_orders"("trackingNo");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_shipperId_fkey" FOREIGN KEY ("shipperId") REFERENCES "shipper_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "common_codes" ADD CONSTRAINT "common_codes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "common_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_histories" ADD CONSTRAINT "employee_histories_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_details" ADD CONSTRAINT "payroll_details_payrollHeaderId_fkey" FOREIGN KEY ("payrollHeaderId") REFERENCES "payroll_headers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_details" ADD CONSTRAINT "payroll_details_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicants" ADD CONSTRAINT "applicants_recruitmentId_fkey" FOREIGN KEY ("recruitmentId") REFERENCES "recruitments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_subjects" ADD CONSTRAINT "account_subjects_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "account_subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_details" ADD CONSTRAINT "voucher_details_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_details" ADD CONSTRAINT "voucher_details_accountSubjectId_fkey" FOREIGN KEY ("accountSubjectId") REFERENCES "account_subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_details" ADD CONSTRAINT "voucher_details_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_details" ADD CONSTRAINT "voucher_details_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_invoices" ADD CONSTRAINT "tax_invoices_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_invoices" ADD CONSTRAINT "tax_invoices_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_invoice_items" ADD CONSTRAINT "tax_invoice_items_taxInvoiceId_fkey" FOREIGN KEY ("taxInvoiceId") REFERENCES "tax_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_headers" ADD CONSTRAINT "budget_headers_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_headers" ADD CONSTRAINT "budget_headers_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_details" ADD CONSTRAINT "budget_details_budgetHeaderId_fkey" FOREIGN KEY ("budgetHeaderId") REFERENCES "budget_headers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_details" ADD CONSTRAINT "budget_details_accountSubjectId_fkey" FOREIGN KEY ("accountSubjectId") REFERENCES "account_subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "item_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "item_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_zones" ADD CONSTRAINT "warehouse_zones_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_targetWarehouseId_fkey" FOREIGN KEY ("targetWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement_details" ADD CONSTRAINT "stock_movement_details_stockMovementId_fkey" FOREIGN KEY ("stockMovementId") REFERENCES "stock_movements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement_details" ADD CONSTRAINT "stock_movement_details_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "warehouse_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_details" ADD CONSTRAINT "quotation_details_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_details" ADD CONSTRAINT "quotation_details_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_details" ADD CONSTRAINT "sales_order_details_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_details" ADD CONSTRAINT "sales_order_details_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_details" ADD CONSTRAINT "delivery_details_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_details" ADD CONSTRAINT "delivery_details_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_details" ADD CONSTRAINT "sales_return_details_salesReturnId_fkey" FOREIGN KEY ("salesReturnId") REFERENCES "sales_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_details" ADD CONSTRAINT "sales_return_details_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_standards" ADD CONSTRAINT "quality_standards_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspection_items" ADD CONSTRAINT "quality_inspection_items_qualityInspectionId_fkey" FOREIGN KEY ("qualityInspectionId") REFERENCES "quality_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_request_details" ADD CONSTRAINT "purchase_request_details_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_request_details" ADD CONSTRAINT "purchase_request_details_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_details" ADD CONSTRAINT "purchase_order_details_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_details" ADD CONSTRAINT "purchase_order_details_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivings" ADD CONSTRAINT "receivings_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivings" ADD CONSTRAINT "receivings_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_details" ADD CONSTRAINT "receiving_details_receivingId_fkey" FOREIGN KEY ("receivingId") REFERENCES "receivings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_details" ADD CONSTRAINT "receiving_details_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "project_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_schedules" ADD CONSTRAINT "project_schedules_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_lines" ADD CONSTRAINT "approval_lines_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "approval_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_documents" ADD CONSTRAINT "approval_documents_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "approval_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_documents" ADD CONSTRAINT "approval_documents_drafterId_fkey" FOREIGN KEY ("drafterId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "approval_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "boards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "post_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oem_contracts" ADD CONSTRAINT "oem_contracts_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_headers" ADD CONSTRAINT "bom_headers_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_details" ADD CONSTRAINT "bom_details_bomHeaderId_fkey" FOREIGN KEY ("bomHeaderId") REFERENCES "bom_headers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_details" ADD CONSTRAINT "bom_details_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_plans" ADD CONSTRAINT "production_plans_bomHeaderId_fkey" FOREIGN KEY ("bomHeaderId") REFERENCES "bom_headers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_plans" ADD CONSTRAINT "production_plans_oemContractId_fkey" FOREIGN KEY ("oemContractId") REFERENCES "oem_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_results" ADD CONSTRAINT "production_results_productionPlanId_fkey" FOREIGN KEY ("productionPlanId") REFERENCES "production_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipper_orders" ADD CONSTRAINT "shipper_orders_shipperId_fkey" FOREIGN KEY ("shipperId") REFERENCES "shipper_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- 완료! 이제 시드 데이터를 넣으세요.
