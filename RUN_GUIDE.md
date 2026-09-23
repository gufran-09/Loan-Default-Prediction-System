# Aegis Risk — Run Guide

This guide details how to set up, configure, and run the **Aegis Risk AI-Powered Loan Default Prediction System**, including the Next.js frontend/backend, Amazon RDS PostgreSQL database (with Supabase fallback), AWS enterprise cloud services (Lambda, Step Functions, Cognito, Bedrock, CloudWatch, SNS), and the Python Machine Learning pipeline.

---

## 1. Prerequisites

* **Node.js**: v18.0.0 or higher
* **Package Manager**: `npm` or `pnpm`
* **Python**: 3.10+ (for ML workflows and database seeding)
* **AWS CLI v2**: Configured with credentials in `ap-southeast-2`
* **Database**: Amazon RDS PostgreSQL 16 (Primary) or Supabase (Fallback)

---

## 2. Environment Configuration

1. Create or verify your `.env` (or `.env.local`) in the project root directory.
2. Required keys:
   ```env
   # Amazon RDS PostgreSQL (Primary Managed Database)
   DATABASE_URL=postgresql://postgres:password@aegis-risk-db.c1wu2mekybkk.ap-southeast-2.rds.amazonaws.com:5432/postgres

   # Supabase Configuration (Operational Fallback)
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

   # AWS Cloud Infrastructure (ap-southeast-2)
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
*(Refer to `.env.example` for the complete template)*

---

## 3. Web Dashboard (Next.js)

### Installation
```bash
npm install
# or
pnpm install
```

### Running the Development Server
```bash
npm run dev
# or
pnpm dev
```
The application will be accessible at: **[http://localhost:3000](http://localhost:3000)**

### Available Application Routes
* `/` — Executive Overview & Key Metrics
* `/borrowers` — Borrower Portfolio & Risk Profiles
* `/borrowers/[id]` — Individual Risk Profile, SHAP Local Explanations, What-If Simulator, Bedrock GenAI Memo, WhatsApp Notification
* `/analytics` — Model Performance, Data Drift Monitoring & Expected Loss Analysis
* `/alerts` — High-Risk Loan Flags & Notifications
* `/signin` — Team Sign In
* `/signup` — Account Registration
* `/api/health` — Production Liveness & Readiness Probing (`/api/health?ready=true`)

### Automated Testing
```bash
npm test
```
> Executes automated unit tests for XGBoost 100-tree model architecture, TreeSHAP impact calculation, and logistic probability bounds.

### Production Build & Standalone Run
```bash
npm run build
npm run start
```

### Containerized Deployment (Docker)
```bash
# Build production image
docker build -t aegis-risk:latest .

# Run container locally
docker run -p 3000:3000 --env-file .env aegis-risk:latest
```

---

## 4. Python Environment & Dependencies

For seeding the database or running ML training/drift scripts:

### Activate Virtual Environment
* **Windows (PowerShell):**
  ```powershell
  .\.venv\Scripts\Activate.ps1
  ```
* **macOS / Linux:**
  ```bash
  source .venv/bin/activate
  ```

### Install Python Packages
```bash
pip install -r requirements.txt
pip install supabase python-dotenv psycopg2-binary
```

---

## 5. Database Seeding & Migrations

### Primary: Amazon RDS PostgreSQL
To apply migrations and populate Amazon RDS PostgreSQL (`aegis-risk-db.c1wu2mekybkk.ap-southeast-2.rds.amazonaws.com`):
```bash
python scripts/seed_rds.py
```
> This migrates all 4 tables (`borrowers`, `risk_scores`, `risk_reasons`, `alerts`), ensures Supabase compatibility roles exist, and upserts 400 borrowers, 400 calibrated risk scores, 93 risk alerts, and 1,200 SHAP reasons.

### Fallback: Supabase Cloud Database
To populate Supabase tables:
```bash
python scripts/seed_database.py
```

---

## 6. Machine Learning Pipeline (Dataset v2.0.0)

Pre-trained model artifacts are stored in `ml/` (`model.pkl`, `model.json`, `feature_columns.json`, `drift_report.json`, `model_card.md`). The pipeline trains on seasoned loans from `Loan_default_v2.csv` with learned missing-value handling.

* **Train XGBoost Production Model:**
  ```bash
  python scripts/train_model.py
  ```
  > Trains calibrated XGBoost on seasoned records, handles missing data, and exports `ml/model.pkl` and `ml/model.json` (100 decision trees).

* **Simulate & Evaluate Feature Drift:**
  ```bash
  python scripts/simulate_drift.py
  ```
  > Evaluates demographic drift (Age split) on Dataset v2 and updates `ml/drift_report.json`.

* **Regenerate Seed Datasets & True TreeSHAP Values:**
  ```bash
  python scripts/prepare_seed_data.py
  ```
  > Samples 400 records from `Loan_default_v2.csv` and executes native XGBoost inference to write `seed_borrowers.csv` and `seed_scores_reasons.csv`.

---

## 7. AWS Cloud Infrastructure Operations

### S3 Model Registry & Artifact Sync
Synchronize trained models, drift reports, and datasets to Amazon S3:
```bash
python scripts/aws_s3_sync.py
```

### Live Serverless Scoring Endpoint Test
```bash
Invoke-RestMethod -Uri "https://a3q6b9scn0.execute-api.ap-southeast-2.amazonaws.com/" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"borrower_id": "test-cli", "features": {"monthly_income": 5500, "loan_amount": 25000, "tenure_months": 36, "outstanding_balance": 10000}}' | ConvertTo-Json
```

### AWS Step Functions STP Credit Decisioning Test
```bash
aws stepfunctions start-execution `
  --state-machine-arn arn:aws:states:ap-southeast-2:022671037337:stateMachine:Aegis-Risk-Credit-Decisioning `
  --input "{\"borrower_id\": \"LN-000101\", \"features\": {\"monthly_income\": 9388, \"loan_amount\": 92393, \"tenure_months\": 36, \"outstanding_balance\": 73914}}" `
  --region ap-southeast-2
```

### Amazon CloudWatch Regulatory Audit Telemetry
```bash
aws logs get-log-events --log-group-name /aegis-risk/audit-trail --log-stream-name underwriter-decisions --region ap-southeast-2
```

### Amazon SNS Critical Underwriter Alert Subscription
```bash
aws sns subscribe --topic-arn arn:aws:sns:ap-southeast-2:022671037337:aegis-risk-critical-alerts --protocol email --notification-endpoint your-email@domain.com --region ap-southeast-2
```


