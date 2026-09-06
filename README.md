# Aegis Risk — AI-Powered Institutional Loan Default Prediction System

Aegis Risk is an institutional-grade credit risk decisioning and portfolio governance platform designed for underwriting teams, risk officers, and bank actuarial committees. The system evaluates borrower default probability using a calibrated **XGBoost** machine learning model, provides explainable **TreeSHAP** attribution factors to ensure full compliance with the **Equal Credit Opportunity Act (ECOA)** and the **Fair Credit Reporting Act (FCRA)**, and enforces continuous model risk governance under **Federal Reserve SR 11-7** guidelines.

---

## Key Highlights

- **Predictive ML Core:** Calibrated XGBoost gradient boosting classifier with weighted loss functions (`scale_pos_weight = 7.6`) achieving **0.7576 AUC-ROC** across 31 continuous and categorical credit features.
- **Explainable AI (XAI):** Real-time TreeSHAP local attribution feature vectors explaining *why* an applicant was flagged or declined.
- **Serverless AWS Inference Seam:** Live serverless inference via **AWS Lambda + API Gateway** in `ap-southeast-2` (`https://a3q6b9scn0.execute-api.ap-southeast-2.amazonaws.com/`) with zero-downtime database cache fallback.
- **Amazon RDS PostgreSQL 16 Enterprise Database:** Production-grade relational database running on Amazon RDS (`aegis-risk-db.c1wu2mekybkk.ap-southeast-2.rds.amazonaws.com:5432`) hosting 400 institutional borrowers, 400 calibrated risk scores, 93 risk alerts, and 1,200 SHAP reasons with automated SSL connection pooling and Supabase dual fallback.
- **AWS Cognito Underwriter Authentication:** Institutional single sign-on (SSO) and role-based access control via **AWS Cognito User Pools** (`ap-southeast-2_80G23Am1X`).
- **AWS Step Functions Credit Decisioning:** Automated Straight-Through Processing (STP) workflow orchestrator (`Aegis-Risk-Credit-Decisioning`) executing auto-approval, underwriter referral, and adverse action pathways in <250ms.
- **Amazon Bedrock GenAI Assistant:** On-demand generation of institutional Credit Underwriting Memos using **Claude 3.5 Haiku** on AWS Bedrock.
- **Meta WhatsApp Business Cloud API Integration:** Automated multi-mode notification dispatch delivering credit decision notices, restructuring terms, and alert notifications to borrowers and risk officers.
- **Automated Adverse Action Notice:** Instant generation of legally compliant consumer declination letters with top adverse factor disclosures (CFPB Regulation B).
- **Interactive "What-If" Scenario Simulator:** Dynamic counterfactual loan restructuring testing loan amount, tenure, and income elasticities in real time.
- **Portfolio Stress-Testing & Expected Loss:** Actuarial Expected Loss calculation ($$EL = PD \times EAD \times LGD$$) and macroeconomic rate shock simulation (+200 bps Fed Hike).
- **Regulatory Telemetry:** Automatic audit event streaming to **Amazon CloudWatch Logs** (`/aegis-risk/audit-trail`), dedicated dashboard (`Aegis-Risk-Model-Health`), and underwriter alerts via **Amazon SNS** (`arn:aws:sns:ap-southeast-2:022671037337:aegis-risk-critical-alerts`).

---

## Architecture Overview

```mermaid
flowchart TB
    subgraph Client [Institutional Cockpit - Next.js 16]
        UI[Underwriter Dashboard<br/>What-If Simulator · Bedrock GenAI Memo · WhatsApp Dispatch]
        AUTH[AWS Cognito User Pool<br/>ap-southeast-2_80G23Am1X]
    end

    subgraph ScoringSeam [Scoring Seam Layer]
        SEAM[lib/scoring/getScore.ts]
    end

    subgraph AWS [AWS Cloud Infrastructure - ap-southeast-2]
        APIGW[Amazon API Gateway v2]
        LAMBDA[AWS Lambda<br/>aegis-risk-scoring-engine]
        STEPFN[AWS Step Functions<br/>Aegis-Risk-Credit-Decisioning]
        RDS[(Amazon RDS PostgreSQL 16<br/>aegis-risk-db.c1wu2mekybkk...)]
        S3[(Amazon S3 Model Lake<br/>s3://aegis-risk-storage-022671037337)]
        CW[(Amazon CloudWatch<br/>/aegis-risk/audit-trail)]
        SNS[Amazon SNS<br/>aegis-risk-critical-alerts]
        BEDROCK[Amazon Bedrock Runtime<br/>Claude 3.5 Haiku]
        WHATSAPP[Meta WhatsApp Cloud API<br/>Borrower Notification Dispatch]
    end

    subgraph Fallback [Operational Fallback]
        DB[(Supabase PostgreSQL<br/>Local/Dev Fallback)]
    end

    AUTH -.->|Authenticate| UI
    UI --> SEAM
    SEAM -->|Primary: Live Inference| APIGW --> LAMBDA
    SEAM -->|Direct STP Workflow| STEPFN
    SEAM -->|Primary DB Read/Write| RDS
    SEAM -->|Fallback DB| DB
    SEAM -->|Compliance Audit| CW
    SEAM -->|Critical Risk Alert| SNS
    UI -->|GenAI Memo| BEDROCK
    UI -->|Decision Notification| WHATSAPP
```

---

## Local Development & Setup

### 1. Prerequisites
- **Node.js 18+** & **npm** / **pnpm**
- **Python 3.10+** (with `pip`)
- **AWS CLI v2** (configured with your AWS account credentials in `ap-southeast-2`)

### 2. Environment Configuration
Copy the configuration template:
```bash
cp .env.example .env
```

Your `.env` should include:
```env
# Amazon RDS PostgreSQL (Primary Managed Database)
DATABASE_URL=postgresql://postgres:password@aegis-risk-db.c1wu2mekybkk.ap-southeast-2.rds.amazonaws.com:5432/postgres

# Operational Database (Supabase Fallback)
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# AWS Cloud Integration Suite (ap-southeast-2)
AWS_REGION=ap-southeast-2
AWS_ACCESS_KEY_ID=<your-access-key-id>
AWS_SECRET_ACCESS_KEY=<your-secret-access-key>
AWS_S3_BUCKET_NAME=aegis-risk-storage-022671037337
AWS_INFERENCE_ENDPOINT_URL=https://a3q6b9scn0.execute-api.ap-southeast-2.amazonaws.com/
AWS_CLOUDWATCH_LOG_GROUP=/aegis-risk/audit-trail
AWS_CLOUDWATCH_ENABLED=true
AWS_SNS_TOPIC_ARN=arn:aws:sns:ap-southeast-2:022671037337:aegis-risk-critical-alerts

# AWS Cognito Identity & User Pools
NEXT_PUBLIC_AWS_COGNITO_USER_POOL_ID=ap-southeast-2_80G23Am1X
NEXT_PUBLIC_AWS_COGNITO_CLIENT_ID=74120ugqosjjpmup4utltl1oqf

# AWS Step Functions Credit Decisioning
AWS_STEP_FUNCTIONS_DECISIONING_ARN=arn:aws:states:ap-southeast-2:022671037337:stateMachine:Aegis-Risk-Credit-Decisioning

# Meta WhatsApp Business Cloud API (Optional - simulation mode active by default)
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
```

### 3. Database Migration & Seeding (Amazon RDS)
Populate Amazon RDS PostgreSQL with all 400 institutional borrowers, risk scores, and TreeSHAP reasons:
```bash
python scripts/seed_rds.py
```

### 4. Install Dependencies & Build
```bash
# Install frontend & AWS SDK dependencies
npm install

# Run build verification
npm run build

# Start local Next.js dev server
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## AWS Infrastructure & CLI Operations

All cloud resources for Aegis Risk can be verified and managed directly via the AWS CLI:

### 1. Amazon RDS PostgreSQL Database
Inspect the live RDS instance and verify connectivity:
```bash
aws rds describe-db-instances --db-instance-identifier aegis-risk-db --region ap-southeast-2
```

### 2. S3 Model Registry & Data Lake
Inspect registered model artifacts, drift reports, and datasets:
```bash
aws s3 ls s3://aegis-risk-storage-022671037337 --recursive
```
Synchronize local training artifacts to S3:
```bash
python scripts/aws_s3_sync.py
```

### 3. Live Serverless Inference Endpoint
Test the live AWS Lambda scoring engine directly:
```bash
Invoke-RestMethod -Uri "https://a3q6b9scn0.execute-api.ap-southeast-2.amazonaws.com/" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"borrower_id": "test-cli", "features": {"monthly_income": 5500, "loan_amount": 25000, "tenure_months": 36, "outstanding_balance": 10000}}' | ConvertTo-Json
```

### 4. AWS Step Functions Credit Decisioning Workflow
Execute the automated credit decision state machine:
```bash
aws stepfunctions start-execution `
  --state-machine-arn arn:aws:states:ap-southeast-2:022671037337:stateMachine:Aegis-Risk-Credit-Decisioning `
  --input "{\"borrower_id\": \"LN-000101\", \"features\": {\"monthly_income\": 9388, \"loan_amount\": 92393, \"tenure_months\": 36, \"outstanding_balance\": 73914}}" `
  --region ap-southeast-2
```

### 5. Regulatory Audit Trail (Amazon CloudWatch)
Inspect underwriter decision events and compliance telemetry (SR 11-7):
```bash
aws logs get-log-events --log-group-name /aegis-risk/audit-trail --log-stream-name underwriter-decisions --region ap-southeast-2
```

### 6. Critical Underwriter Alerts (Amazon SNS)
Subscribe an underwriter's email or mobile phone to instant notifications:
```bash
aws sns subscribe --topic-arn arn:aws:sns:ap-southeast-2:022671037337:aegis-risk-critical-alerts --protocol email --notification-endpoint your-email@domain.com --region ap-southeast-2
```

---

## Detailed System Documentation

For deep-dive architectural specifications, database migration definitions, regulatory compliance mappings, and presentation pitch flows, refer to:
- **[AEGIS_RISK_IMPLEMENTATION_GUIDE.md](file:///d:/Java-%20Backend/Project/Mass%20Mutual/ai-powered-loan-default-prediction-system/AEGIS_RISK_IMPLEMENTATION_GUIDE.md)**: Authoritative master engineering & institutional specification.
- **[AWS_ONE_DAY_INTEGRATION_PLAN.md](file:///d:/Java-%20Backend/Project/Mass%20Mutual/ai-powered-loan-default-prediction-system/AWS_ONE_DAY_INTEGRATION_PLAN.md)**: Production deployment log, AWS CLI commands, and cloud cost breakdowns.
- **[RUN_GUIDE.md](file:///d:/Java-%20Backend/Project/Mass%20Mutual/ai-powered-loan-default-prediction-system/RUN_GUIDE.md)**: Operational setup and step-by-step developer runbook.
- **[docs/api-contract.md](file:///d:/Java-%20Backend/Project/Mass%20Mutual/ai-powered-loan-default-prediction-system/docs/api-contract.md)**: REST API contracts, schemas, and error shapes.
- **[ml/model_card.md](file:///d:/Java-%20Backend/Project/Mass%20Mutual/ai-powered-loan-default-prediction-system/ml/model_card.md)**: Model card documenting XGBoost metrics, confusion matrices, and limitations.
