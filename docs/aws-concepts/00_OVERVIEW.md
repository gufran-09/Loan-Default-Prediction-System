# Aegis Risk — AWS Cloud Architecture & Concepts Guide

This directory contains deep-dive architectural documentation explaining each AWS concept and managed service utilized across the **Aegis Risk** credit decisioning platform.

---

## 📑 Table of Contents

| # | File | AWS Concept | AWS Service | Core Purpose in Aegis Risk |
|---|------|-------------|-------------|----------------------------|
| **01** | [`01_SERVERLESS_COMPUTE_LAMBDA.md`](./01_SERVERLESS_COMPUTE_LAMBDA.md) | **Serverless Compute** | AWS Lambda | Real-time, event-driven default risk scoring engine |
| **02** | [`02_API_GATEWAY_MICROSERVICES.md`](./02_API_GATEWAY_MICROSERVICES.md) | **Edge API Gateway** | Amazon API Gateway v2 | Low-latency REST proxy & decoupling layer |
| **03** | [`03_WORKFLOW_ORCHESTRATION_STEP_FUNCTIONS.md`](./03_WORKFLOW_ORCHESTRATION_STEP_FUNCTIONS.md) | **Workflow Orchestration** | AWS Step Functions | Straight-Through Processing (STP) credit decisioning state machine |
| **04** | [`04_MANAGED_DATABASE_RDS_POSTGRESQL.md`](./04_MANAGED_DATABASE_RDS_POSTGRESQL.md) | **Managed Relational Persistence** | Amazon RDS (PostgreSQL 16) | Institutional system of record for borrowers, scores, and alerts |
| **05** | [`05_GENERATIVE_AI_AMAZON_BEDROCK.md`](./05_GENERATIVE_AI_AMAZON_BEDROCK.md) | **Generative AI & Foundation Models** | Amazon Bedrock (Claude 3.5 Haiku) | Sub-3s automated Credit Underwriting Memorandum synthesis |
| **06** | [`06_OBJECT_STORAGE_MLOPS_S3.md`](./06_OBJECT_STORAGE_MLOPS_S3.md) | **Object Storage & MLOps Registry** | Amazon S3 | Immutable model artifact lake, scalers, and drift baselines |
| **07** | [`07_IDENTITY_ACCESS_MANAGEMENT_COGNITO_IAM.md`](./07_IDENTITY_ACCESS_MANAGEMENT_COGNITO_IAM.md) | **Identity & Role-Based Access** | AWS Cognito & IAM | Underwriter SSO, JWT verification, and least-privilege policies |
| **08** | [`08_OBSERVABILITY_GOVERNANCE_CLOUDWATCH.md`](./08_OBSERVABILITY_GOVERNANCE_CLOUDWATCH.md) | **Observability & Model Governance** | Amazon CloudWatch | Immutable audit logging for Fed SR 11-7 compliance & telemetry |
| **09** | [`09_EVENT_DRIVEN_MESSAGING_SNS.md`](./09_EVENT_DRIVEN_MESSAGING_SNS.md) | **Pub/Sub Messaging** | Amazon SNS | Asynchronous event push for critical credit threshold breaches |
| **10** | [`10_DOCUMENT_INTELLIGENCE_AMAZON_TEXTRACT.md`](./10_DOCUMENT_INTELLIGENCE_AMAZON_TEXTRACT.md) | **Document Intelligence & OCR** | Amazon Textract | Automated payslip & tax document income extraction for DTI validation |
| **11** | [`11_CONTAINER_ORCHESTRATION_ECS_FARGATE.md`](./11_CONTAINER_ORCHESTRATION_ECS_FARGATE.md) | **Serverless Container Compute** | Amazon ECS & AWS Fargate | Production Next.js 16 container runtime with zero-downtime rolling updates |
| **12** | [`12_CONTAINER_REGISTRY_AMAZON_ECR.md`](./12_CONTAINER_REGISTRY_AMAZON_ECR.md) | **Private Container Registry** | Amazon ECR | AES-256 encrypted Docker image storage with IAM token auth |
| **13** | [`13_CLOUD_CI_CD_AWS_CODEBUILD.md`](./13_CLOUD_CI_CD_AWS_CODEBUILD.md) | **Cloud CI/CD Build Automation** | AWS CodeBuild | On-demand Linux Docker build pipeline triggered from S3 source bundles |
| **14** | [`14_LOAD_BALANCING_NETWORKING_ALB_VPC.md`](./14_LOAD_BALANCING_NETWORKING_ALB_VPC.md) | **Load Balancing & VPC Networking** | Elastic Load Balancing (ALB) & VPC | Multi-AZ Layer-7 traffic routing, `/api/health` probing & Security Groups |

---

## 🏗️ High-Level Cloud Architecture Diagram

```
                 [ Underwriter / Credit Officer ]
                                |
                    HTTP/HTTPS -> Elastic Load Balancing
                 (Application Load Balancer: aegis-risk-alb)
                                |
                       Amazon VPC & Security Groups
                                |
                 Amazon ECS Fargate (Next.js 16 Standalone)
                 [ Built by AWS CodeBuild -> Stored in ECR ]
                                |
        +-----------------------+-----------------------+
        |                                               |
  (Authentication)                              (Scoring Request)
   AWS Cognito                                  API Gateway v2
  (SSO / JWT Tokens)                                    |
                                                   AWS Lambda
                                             (XGBoost Scoring Engine)
                                                        |
                                          +-------------+-------------+
                                          |                           |
                                  AWS Step Functions            Amazon S3
                              (STP Workflow Orchestration)  (Model Artifact Lake)
                                    /     |     \
                                   /      |      \
                            Approve     Refer     Decline
                              |           |          |
                              v           v          v
                 +--------------------------------------------+
                 |            Downstream Integrations         |
                 | - Amazon RDS PostgreSQL (State of Record)  |
                 | - Amazon Bedrock (GenAI Credit Memo)       |
                 | - Amazon Textract (Payslip OCR Extraction) |
                 | - CloudWatch (Audit Trail & Telemetry)     |
                 | - Amazon SNS (Critical Risk Alerts)        |
                 | - Meta WhatsApp Cloud API (Borrower Notice)|
                 +--------------------------------------------+
```
