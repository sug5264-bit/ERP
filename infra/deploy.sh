#!/bin/bash
set -euo pipefail

# ============================================================
# ERP System - AWS Infrastructure Deployment Script
# ============================================================
# Usage:
#   ./infra/deploy.sh --env production --db-url "postgresql://..." --auth-secret "..."
#   ./infra/deploy.sh --env production --db-url "postgresql://..." --auth-secret "..." --cert-arn "arn:aws:acm:..." --domain "erp.example.com"
# ============================================================

AWS_REGION="${AWS_REGION:-ap-northeast-2}"
STACK_NAME=""
ENVIRONMENT=""
DB_URL=""
AUTH_SECRET=""
CERT_ARN=""
DOMAIN=""

usage() {
  echo "Usage: $0 --env <production|staging> --db-url <DATABASE_URL> --auth-secret <AUTH_SECRET> [--cert-arn <ACM_ARN>] [--domain <DOMAIN>]"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --env) ENVIRONMENT="$2"; shift 2 ;;
    --db-url) DB_URL="$2"; shift 2 ;;
    --auth-secret) AUTH_SECRET="$2"; shift 2 ;;
    --cert-arn) CERT_ARN="$2"; shift 2 ;;
    --domain) DOMAIN="$2"; shift 2 ;;
    --region) AWS_REGION="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
done

if [[ -z "$ENVIRONMENT" || -z "$DB_URL" || -z "$AUTH_SECRET" ]]; then
  usage
fi

STACK_NAME="erp-${ENVIRONMENT}"

echo "=== Deploying ERP Infrastructure ==="
echo "  Environment: $ENVIRONMENT"
echo "  Region:      $AWS_REGION"
echo "  Stack:       $STACK_NAME"
echo ""

# Deploy CloudFormation stack
aws cloudformation deploy \
  --template-file "$(dirname "$0")/cloudformation.yml" \
  --stack-name "$STACK_NAME" \
  --region "$AWS_REGION" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    "EnvironmentName=$ENVIRONMENT" \
    "DatabaseUrl=$DB_URL" \
    "AuthSecret=$AUTH_SECRET" \
    "CertificateArn=$CERT_ARN" \
    "DomainName=$DOMAIN" \
  --tags \
    "Project=erp-system" \
    "Environment=$ENVIRONMENT"

echo ""
echo "=== Stack Outputs ==="
aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$AWS_REGION" \
  --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
  --output table

echo ""
echo "=== Next Steps ==="
echo "1. Copy the GitHubActionsRoleArn output and set it as AWS_ROLE_ARN secret in GitHub"
echo "2. Push code to main branch to trigger CI/CD pipeline"
echo "3. (Optional) Set up Route 53 DNS record pointing to ALB DNS name"
