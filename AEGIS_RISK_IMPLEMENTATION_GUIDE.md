# Aegis Risk — Master Implementation Guide & System Specification

**Project:** AI-Powered Loan Default Prediction System (PS-01)  
**Enterprise Target:** MassMutual Financial Group (Institutional Credit & Actuarial Risk Evaluation)  
**Team Composition:** 3 Members (ML Engineer, Backend & Infrastructure Engineer, Frontend Engineer)  
**Core Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS, Amazon RDS PostgreSQL 16 (Primary), Supabase (Fallback), AWS Cognito, AWS Step Functions, Meta WhatsApp Cloud API, AWS Bedrock (Claude 3.5 Haiku), AWS Lambda + API Gateway v2, Amazon S3, Amazon CloudWatch, Amazon SNS, Python 3.10+ (XGBoost, Scikit-learn, SHAP, Pandas, Faker)  
**Primary Dataset:** `Loan_default_cleaned.csv` — 255,347 records, 32 columns, 0 nulls, target `Default` (11.6% minority class)

---

## Document Purpose

This document serves as the **authoritative, single-source-of-truth master specification** for the Aegis Risk system. It synthesizes all technical documentation, architectural patterns, machine learning workflows, database schemas, API contracts, enterprise underwriting features, regulatory compliance protocols, and step-by-step operational run guides into one unified reference.

---

## Table of Contents

1. [Executive Summary & System Architecture](#1-executive-summary--system-architecture)
2. [Database Schema & Data Persistence (Amazon RDS PostgreSQL & Supabase)](#2-database-schema--data-persistence-amazon-rds-postgresql--supabase)
3. [REST API Specifications & Scoring Seam Contract](#3-rest-api-specifications--scoring-seam-contract)
4. [Machine Learning Pipeline & Model Governance (Python)](#4-machine-learning-pipeline--model-governance-python)
5. [Data Bridge, Synthetic PII & Ingestion Pipeline](#5-data-bridge-synthetic-pii--ingestion-pipeline)
6. [Frontend Application & Interactive Underwriting Cockpit](#6-frontend-application--interactive-underwriting-cockpit)
7. [MassMutual Enterprise Strategy, Compliance & Financial Impact](#7-massmutual-enterprise-strategy-compliance--financial-impact)
8. [Setup, Execution & Operations Guide](#8-setup-execution--operations-guide)
9. [Team Roles, Responsibilities & Execution Checklist](#9-team-roles-responsibilities--execution-checklist)

---

## 1. Executive Summary & System Architecture

### 1.1 System Objectives
Traditional retail credit assessment models depend heavily on lagged credit bureau scores (FICO) and linear scorecards that fail to capture non-linear default interactions and volatile macroeconomic pressures. Aegis Risk implements an end-to-end, enterprise-grade AI credit decisioning platform that:
- Predicts individual borrower default probability using a calibrated **XGBoost gradient boosting classifier** with weighted loss functions (`scale_pos_weight = 7.6`).
- Explains model decisions through **SHAP (SHapley Additive exPlanations)** feature attribution to meet federal fair lending regulations (**ECOA**, **FCRA**, **CFPB**).
- Simulates demographic and macroeconomic **covariate drift** to satisfy **Federal Reserve SR 11-7** Model Risk Management guidelines.
- Provides credit officers with active decision-support tools: real-time **What-If scenario loan restructuring**, automated **Adverse Action Notice generation**, interactive **applicant scoring**, and **portfolio Expected Loss ($$EL = PD \times EAD \times LGD$$)** aggregation.
- Coordinates institutional credit workflows through **AWS Step Functions** (Straight-Through Processing STP), synthesizes underwriting rationale via **Amazon Bedrock Claude 3.5 Haiku**, and notifies borrowers via **Meta WhatsApp Business Cloud API**.

### 1.2 System Architecture Diagram

```mermaid
flowchart TB
    subgraph Data & ML Layer [Python 3.10+ Machine Learning Layer]
        RAW[(Loan_default_cleaned.csv<br/>255,347 rows)] --> TRAIN[scripts/train_model.py]
        TRAIN --> ARTIFACTS[ml/model.pkl<br/>ml/feature_columns.json<br/>ml/model_card.md]
        TRAIN --> DRIFT[scripts/simulate_drift.py]
        DRIFT --> DRIFT_JSON[ml/drift_report.json]
        ARTIFACTS --> S3[scripts/aws_s3_sync.py<br/>AWS S3 Model Lake]
        ARTIFACTS --> BRIDGE[scripts/prepare_seed_data.py<br/>Faker PII + SHAP Calculation]
        BRIDGE --> SEED_FILES[(seed_borrowers.csv<br/>seed_scores_reasons.csv)]
        SEED_FILES --> RDS_LOADER[scripts/seed_rds.py]
    end

    subgraph Storage Layer [Enterprise Relational Persistence]
        RDS_LOADER -->|Direct SSL Connection| RDS[(Amazon RDS PostgreSQL 16<br/>aegis-risk-db.c1wu2mekybkk...)]
        RDS --> T_BORROWERS[borrowers Table - 400 rows]
        RDS --> T_SCORES[risk_scores Table - 400 rows]
        RDS --> T_REASONS[risk_reasons Table - 1200 rows]
        RDS --> T_ALERTS[alerts Table - 93 rows]
        FALLBACK_DB[(Supabase PostgreSQL<br/>Development Fallback)]
    end

    subgraph AWS Enterprise Cloud [AWS Cloud Suite - ap-southeast-2]
        APIGW[Amazon API Gateway v2]
        LAMBDA[AWS Lambda<br/>aegis-risk-scoring-engine]
        STEPFN[AWS Step Functions<br/>Aegis-Risk-Credit-Decisioning]
        CW[(Amazon CloudWatch Logs<br/>/aegis-risk/audit-trail)]
        SNS[Amazon SNS Topic<br/>aegis-risk-critical-alerts]
        BEDROCK[Amazon Bedrock Runtime<br/>Claude 3.5 Haiku]
        COGNITO[AWS Cognito User Pool<br/>ap-southeast-2_80G23Am1X]
        WHATSAPP[Meta WhatsApp Cloud API<br/>Borrower Notifications]
    end

    subgraph Application Server [Next.js 16 App Router & Server APIs]
        POOL[lib/db/postgres.ts<br/>RDS Connection Pool]
        SEAM[lib/scoring/getScore.ts<br/>Decoupled Scoring Seam]
        API_SCORE[/api/borrowers/:id/score]
        API_MEMO[/api/borrowers/:id/memo]
        API_WA[/api/borrowers/:id/whatsapp]
        API_BORROWERS[/api/borrowers]
        API_ALERTS[/api/alerts & /api/alerts/:id]
        API_PORTFOLIO[/api/analytics/portfolio]
        DRIFT_JSON --> API_DRIFT[/api/analytics/drift]
    end

    subgraph Client UI [Risk Officer & Underwriter Cockpit]
        COGNITO -.->|SSO Authentication| UI_SHELL[Institutional Shell]
        UI_SHELL --> UI_BORROWERS[Borrower Portfolio & Filters<br/>/borrowers]
        UI_SHELL --> UI_DETAIL[Borrower Detail & SHAP Chart<br/>What-If Restructuring Simulator<br/>Bedrock GenAI Memo & WhatsApp Modal<br/>Adverse Action Generator<br/>/borrowers/:id]
        UI_SHELL --> UI_ALERTS[Alert Triage Operations Desk<br/>/alerts]
        UI_SHELL --> UI_ANALYTICS[Portfolio Analytics, Expected Loss &<br/>Model Drift Governance<br/>/analytics]
    end

    RDS --> POOL
    FALLBACK_DB -.->|Fallback Query| POOL
    POOL --> API_BORROWERS & API_ALERTS & API_PORTFOLIO & SEAM
    SEAM -->|Primary: Live Inference| APIGW --> LAMBDA
    SEAM -->|Regulatory Telemetry| CW
    SEAM -->|Critical Risk Alert| SNS
    UI_DETAIL --> API_MEMO --> BEDROCK
    UI_DETAIL --> API_WA --> WHATSAPP
    UI_DETAIL --> STEPFN
```

### 1.3 Architectural Decoupling: The Scoring Seam
The application enforces strict architectural isolation between the UI client and the scoring inference engine via [`lib/scoring/getScore.ts`](file:///d:/Java-%20Backend/Project/Mass%20Mutual/ai-powered-loan-default-prediction-system/lib/scoring/getScore.ts). 
- **Active Production Cloud Mode:** Configured with live **AWS Lambda + API Gateway** (`https://a3q6b9scn0.execute-api.ap-southeast-2.amazonaws.com/`). When enabled via `AWS_INFERENCE_ENDPOINT_URL`, live credit feature vectors are scored in real time with automated TreeSHAP attribution generation.
- **Enterprise Persistence:** Direct PostgreSQL connection pool via **Amazon RDS PostgreSQL 16** (`lib/db/postgres.ts`), ensuring enterprise Multi-AZ security, SSL encryption, and high connection concurrency.
- **Graceful Fallback Mode:** If the cloud endpoint is unreachable or in offline demonstration mode, `getScore(borrowerId)` transparently falls back to pre-computed database cache. The REST API contract and frontend consumers require zero code modifications.
- **Regulatory Telemetry:** Every assessment access event is automatically dispatched to **Amazon CloudWatch Logs** (`/aegis-risk/audit-trail`), and **CRITICAL** risk evaluations trigger push alerts to underwriting teams via **Amazon SNS** (`arn:aws:sns:ap-southeast-2:022671037337:aegis-risk-critical-alerts`).



---

## 2. Database Schema & Data Persistence (Amazon RDS PostgreSQL & Supabase)

The primary institutional data layer is hosted on **Amazon RDS PostgreSQL 16.9** (`aegis-risk-db.c1wu2mekybkk.ap-southeast-2.rds.amazonaws.com:5432`), provisioned in AWS region `ap-southeast-2` with Multi-AZ capability and SSL/TLS encryption in transit. The application maintains dual compatibility, connecting to Amazon RDS via connection pooling in [`lib/db/postgres.ts`](file:///d:/Java-%20Backend/Project/Mass%20Mutual/ai-powered-loan-default-prediction-system/lib/db/postgres.ts) with transparent fallback to Supabase PostgreSQL for local development.

The database schema is managed via SQL migrations located in `supabase/migrations/` and automated for Amazon RDS via `scripts/seed_rds.py`.

### 2.1 Entity Relationship Diagram

```mermaid
erDiagram
    BORROWERS ||--|| RISK_SCORES : "has"
    RISK_SCORES ||--|{ RISK_REASONS : "contains"
    BORROWERS ||--o{ ALERTS : "triggers"

    BORROWERS {
        uuid id PK
        text external_id UK
        text full_name
        text email UK
        text loan_type
        numeric loan_amount
        numeric outstanding_balance
        text geography
        integer tenure_months
        numeric monthly_income
        text employment_status
        timestamptz created_at
    }

    RISK_SCORES {
        uuid id PK
        uuid borrower_id FK
        numeric score
        text bucket
        text model_version
        timestamptz scored_at
    }

    RISK_REASONS {
        uuid id PK
        uuid risk_score_id FK
        text reason
        text feature
        numeric impact
        integer rank
    }

    ALERTS {
        uuid id PK
        uuid borrower_id FK
        text title
        text description
        text severity
        text status
        timestamptz created_at
    }
```

### 2.2 Table Definitions & Constraints

#### Table: `borrowers`
Primary registry of loan accounts and borrower demographic/financial attributes.
```sql
CREATE TABLE IF NOT EXISTS borrowers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  loan_type TEXT NOT NULL,
  loan_amount NUMERIC NOT NULL,
  outstanding_balance NUMERIC NOT NULL,
  geography TEXT NOT NULL,
  tenure_months INTEGER NOT NULL,
  monthly_income NUMERIC NOT NULL,
  employment_status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Table: `risk_scores`
Historical and active probability of default (PD) predictions generated by ML models.
```sql
CREATE TABLE IF NOT EXISTS risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES borrowers(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL,
  bucket TEXT NOT NULL CHECK (bucket IN ('low', 'medium', 'high', 'critical')),
  model_version TEXT NOT NULL,
  scored_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Table: `risk_reasons`
Local SHAP feature attributions explaining the specific drivers behind each risk score.
```sql
CREATE TABLE IF NOT EXISTS risk_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_score_id UUID NOT NULL REFERENCES risk_scores(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  feature TEXT NOT NULL,
  impact NUMERIC NOT NULL,
  rank INTEGER NOT NULL
);
```

#### Table: `alerts`
Concentration risk alerts and high-severity default warnings for underwriting triage.
```sql
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES borrowers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2.3 Automated Database Triggers & Business Logic
The PostgreSQL layer features an active trigger that automatically generates open alerts whenever a `high` or `critical` risk score is inserted:
```sql
CREATE OR REPLACE FUNCTION generate_risk_alert()
RETURNS TRIGGER AS $$
DECLARE
  v_borrower_name TEXT;
  v_external_id TEXT;
BEGIN
  IF NEW.bucket IN ('high', 'critical') THEN
    SELECT full_name, external_id INTO v_borrower_name, v_external_id
    FROM borrowers WHERE id = NEW.borrower_id;

    INSERT INTO alerts (borrower_id, title, description, severity, status)
    VALUES (
      NEW.borrower_id,
      CASE 
        WHEN NEW.bucket = 'critical' THEN 'Critical Default Risk Detected'
        ELSE 'High Risk Borrower Warning'
      END,
      'Borrower ' || COALESCE(v_borrower_name, 'Unknown') || ' (' || COALESCE(v_external_id, 'N/A') || ') scored ' || ROUND(NEW.score, 4) || ' in ' || UPPER(NEW.bucket) || ' risk bucket.',
      NEW.bucket,
      'open'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_risk_alert ON risk_scores;
CREATE TRIGGER trg_generate_risk_alert
AFTER INSERT ON risk_scores
FOR EACH ROW
EXECUTE FUNCTION generate_risk_alert();
```

### 2.4 Row-Level Security (RLS) & Governance Policies
All database tables enforce RLS. Only authenticated users with active sessions can query records or update alert triage statuses:
- **SELECT Policies:** Authenticated read on `borrowers`, `risk_scores`, `risk_reasons`, and `alerts`.
- **UPDATE Policies:** Authenticated update on `alerts` allowing credit officers to mutate `status` (`open` -> `acknowledged` -> `resolved`).
- **SERVICE ROLE Access:** Dedicated bypass key utilized by the Python ingestion script (`scripts/seed_database.py`) for administrative batch loading.

---

## 3. REST API Specifications & Scoring Seam Contract

All API routes require an authenticated Supabase cookie or bearer session. Errors follow a standardized RFC-compliant envelope:
```json
{
  "error": {
    "code": "UNAUTHORIZED | NOT_FOUND | BAD_REQUEST | DB_ERROR",
    "message": "Descriptive human-readable explanation"
  }
}
```

### 3.1 `GET /api/borrowers`
Retrieves a paginated list of borrowers with associated risk scores and bucket data.
- **Query Parameters:**
  - `page` (integer, default: `1`): Current page number.
  - `pageSize` (integer, default: `10`, max: `100`): Records per page.
  - `search` (string, optional): Case-insensitive search on `full_name` and `external_id`.
  - `bucket` (string, optional): Filter by `low`, `medium`, `high`, `critical`.
- **Response (`200 OK`):**
```json
{
  "data": [
    {
      "id": "c7a86e92-d962-4bf1-897c-613d09aef810",
      "external_id": "LN-000101",
      "full_name": "Marcus Vance",
      "email": "marcus.vance@example.com",
      "loan_type": "Auto",
      "loan_amount": 28500,
      "outstanding_balance": 22400.0,
      "geography": "North America",
      "tenure_months": 48,
      "monthly_income": 4850.0,
      "employment_status": "Full-time",
      "risk_scores": [
        {
          "id": "e817d23a-f501-4be2-9844-77a83d98ec11",
          "score": 0.7824,
          "bucket": "high",
          "model_version": "v1.0.0",
          "scored_at": "2026-08-01T14:30:00Z"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 400,
    "totalPages": 40
  }
}
```

### 3.2 `GET /api/borrowers/:id/score`
Unified scoring seam endpoint. Returns both borrower profile parameters and detailed model output with ranked SHAP local feature attributions.
- **Path Parameter:** `id` (UUID of borrower)
- **Response (`200 OK`):**
```json
{
  "data": {
    "score": 0.8142,
    "bucket": "critical",
    "model_version": "v1.0.0",
    "scored_at": "2026-08-01T14:30:00Z",
    "risk_reasons": [
      {
        "reason": "Elevated Debt-to-Income (DTI) ratio severely strains monthly cashflow",
        "feature": "DTIRatio",
        "impact": 0.384,
        "rank": 1
      },
      {
        "reason": "Credit score falls below prime underwriting thresholds",
        "feature": "CreditScore",
        "impact": 0.291,
        "rank": 2
      },
      {
        "reason": "Substantial outstanding loan balance increases loss exposure",
        "feature": "LoanAmount",
        "impact": 0.162,
        "rank": 3
      }
    ],
    "borrower": {
      "id": "c7a86e92-d962-4bf1-897c-613d09aef810",
      "external_id": "LN-000101",
      "full_name": "Marcus Vance",
      "email": "marcus.vance@example.com",
      "loan_type": "Auto",
      "loan_amount": 28500,
      "outstanding_balance": 22400.0,
      "geography": "North America",
      "tenure_months": 48,
      "monthly_income": 4850.0,
      "employment_status": "Full-time"
    }
  }
}
```

### 3.3 `GET /api/alerts`
Returns active concentration risk alerts joined with borrower identity and loan exposure data.
- **Query Parameters:**
  - `status` (string, optional): `open`, `acknowledged`, `resolved`
  - `severity` (string, optional): `critical`, `high`, `medium`, `low`
- **Response (`200 OK`):**
```json
{
  "data": [
    {
      "id": "4b68e980-6bc1-4475-81fa-5847e30d1991",
      "borrower_id": "c7a86e92-d962-4bf1-897c-613d09aef810",
      "title": "Critical Default Risk Detected",
      "description": "Borrower Marcus Vance (LN-000101) scored 0.8142 in CRITICAL risk bucket.",
      "severity": "critical",
      "status": "open",
      "created_at": "2026-08-01T14:30:00Z",
      "borrowers": {
        "id": "c7a86e92-d962-4bf1-897c-613d09aef810",
        "external_id": "LN-000101",
        "full_name": "Marcus Vance",
        "email": "marcus.vance@example.com",
        "loan_amount": 28500,
        "outstanding_balance": 22400.0
      }
    }
  ]
}
```

### 3.4 `PATCH /api/alerts/:id`
Updates the underwriting triage lifecycle state of an alert.
- **Request Body:**
```json
{
  "status": "acknowledged" 
}
```
*(Accepted values: `"open"`, `"acknowledged"`, `"resolved"`)*
- **Response (`200 OK`):**
```json
{
  "data": {
    "id": "4b68e980-6bc1-4475-81fa-5847e30d1991",
    "status": "acknowledged"
  },
  "message": "Alert status updated to acknowledged"
}
```

### 3.5 `GET /api/analytics/portfolio`
Aggregates book-level exposure metrics, Expected Loss KPIs, and portfolio risk distributions.
- **Response (`200 OK`):**
```json
{
  "data": {
    "summary": {
      "totalBorrowers": 400,
      "totalLoanVolume": 38450000,
      "totalOutstandingBalance": 29810000,
      "averageScore": 0.2842,
      "criticalAlerts": 18,
      "highRiskBorrowers": 42
    },
    "byLoanType": [
      { "name": "Auto", "total": 85, "score": 0.26 },
      { "name": "Business", "total": 110, "score": 0.34 },
      { "name": "Home", "total": 125, "score": 0.22 },
      { "name": "Personal", "total": 80, "score": 0.31 }
    ],
    "byGeography": [
      { "name": "North America", "total": 140, "score": 0.24 },
      { "name": "Europe", "total": 115, "score": 0.29 },
      { "name": "Asia", "total": 85, "score": 0.32 },
      { "name": "Other", "total": 60, "score": 0.27 }
    ],
    "byTenure": [
      { "name": "12-24m", "total": 95, "score": 0.21 },
      { "name": "25-36m", "total": 160, "score": 0.28 },
      { "name": "37-60m", "total": 145, "score": 0.33 }
    ]
  }
}
```

### 3.6 `GET /api/analytics/drift`
Surfaces the quantitative model drift and demographic covariate shift metrics generated by the Python ML pipeline for model risk audit compliance.
- **Response (`200 OK`):**
```json
{
  "data": {
    "simulation_type": "Demographic Drift (Age Split)",
    "in_distribution_group": "Age < 40",
    "out_of_distribution_group": "Age >= 40",
    "in_distribution_auc": 0.7448,
    "out_of_distribution_auc": 0.7099,
    "auc_degradation": 0.0349,
    "status": "Drift Report Generated Successfully"
  }
}
```

### 3.7 `POST /api/borrowers/:id/memo`
Synthesizes a structured institutional Credit Underwriting Memorandum using **Claude 3.5 Haiku on Amazon Bedrock** (`anthropic.claude-3-5-haiku-20241022-v1:0`).
- **Request Body (`application/json`):**
```json
{
  "borrowerName": "Allison Hill",
  "loanAmount": 92393,
  "monthlyIncome": 9388,
  "tenureMonths": 36,
  "score": 724,
  "bucket": "HIGH",
  "riskReasons": [
    {
      "reason": "Interest rate is high relative to debt service capacity",
      "impact": 0.534
    }
  ]
}
```
- **Response (`200 OK`):**
```json
{
  "memo": "## INSTITUTIONAL CREDIT UNDERWRITING MEMORANDUM\n\n**Applicant:** Allison Hill\n**Loan Amount Requested:** $92,393\n**Assessed Default Probability Score:** 724 / 1000 (HIGH RISK)..."
}
```

### 3.8 `POST /api/borrowers/:id/whatsapp`
Dispatches automated credit decisioning alerts, loan restructuring terms, or adverse action notifications directly to the borrower via the **Meta WhatsApp Business Cloud API** (with simulated fallback).
- **Request Body (`application/json`):**
```json
{
  "phoneNumber": "+1234567890",
  "borrowerName": "Allison Hill",
  "score": 724,
  "bucket": "HIGH",
  "reasons": ["Interest rate is high relative to debt service capacity"],
  "status": "MANUAL_REVIEW"
}
```
- **Response (`200 OK`):**
```json
{
  "data": {
    "success": true,
    "mode": "SIMULATION",
    "messageId": "wa_sim_1725619200000",
    "recipient": "+1234567890",
    "summary": "WhatsApp notification dispatched for Allison Hill (Status: MANUAL_REVIEW, Score: 724)"
  }
}
```

---

## 4. Machine Learning Pipeline & Model Governance (Python)

### 4.1 Dataset Profile: `Loan_default_cleaned.csv`
- **Total Records:** 255,347 loans
- **Total Features:** 31 input predictors + 1 binary target (`Default`)
- **Data Hygiene:** 0 missing values, 0 duplicates, verified data types
- **Target Distribution:** 225,699 non-defaults (88.4%) vs. 29,648 defaults (11.6%)
- **Imbalance Ratio:** ~7.61 negatives to 1 positive

### 4.2 Feature Space & Column Order (`ml/feature_columns.json`)
The model expects exactly 31 features in deterministic order:
1. `Age` (Continuous)
2. `Income` (Continuous, Annual USD)
3. `LoanAmount` (Continuous USD)
4. `CreditScore` (Continuous, 300-850)
5. `MonthsEmployed` (Continuous)
6. `NumCreditLines` (Discrete integer)
7. `InterestRate` (Continuous percentage)
8. `LoanTerm` (Discrete months: 12, 24, 36, 48, 60)
9. `DTIRatio` (Continuous debt-to-income ratio: 0.1 - 0.9)
10. `Education_High School` (One-hot binary)
11. `Education_Master's` (One-hot binary)
12. `Education_PhD` (One-hot binary)
13. `EmploymentType_Part-time` (One-hot binary)
14. `EmploymentType_Self-employed` (One-hot binary)
15. `EmploymentType_Unemployed` (One-hot binary)
16. `MaritalStatus_Married` (One-hot binary)
17. `MaritalStatus_Single` (One-hot binary)
18. `HasMortgage_Yes` (One-hot binary)
19. `HasDependents_Yes` (One-hot binary)
20. `LoanPurpose_Business` (One-hot binary)
21. `LoanPurpose_Education` (One-hot binary)
22. `LoanPurpose_Home` (One-hot binary)
23. `LoanPurpose_Other` (One-hot binary)
24. `HasCoSigner_Yes` (One-hot binary)
*(Plus additional categorical indicator encodings established during one-hot preprocessing)*

### 4.3 Training Methodology & Class Imbalance Handling (`scripts/train_model.py`)
1. **Stratified Split:** 80% train (204,277 rows) / 20% test (51,070 rows) using `stratify=y` to prevent target ratio distortion.
2. **Benchmark Model:** Scikit-Learn `LogisticRegression(max_iter=1000)` establishing the linear regulatory baseline (**AUC-ROC: 0.7491**).
3. **Primary Model:** `xgboost.XGBClassifier` with:
   - `n_estimators = 100`
   - `max_depth = 4` (controls tree complexity and prevents over-fitting)
   - `learning_rate = 0.1`
   - `scale_pos_weight = 7.61` ($$\frac{N_{negative}}{N_{positive}}$$)
   - Objective: `binary:logistic`, Evaluation metric: `logloss`
4. **Why `scale_pos_weight` over SMOTE?** In institutional credit modeling, synthetic oversampling (SMOTE) alters joint feature probability distributions and can synthesize unrealistic applicant profiles. Loss-weight scaling directly penalizes false negatives without corrupting underlying empirical distributions.

### 4.4 Quantitative Evaluation Results
- **Primary XGBoost AUC-ROC:** **0.7576** (Outperforms baseline Logistic Regression 0.7491)
- **Test Set Confusion Matrix (Threshold = 0.5):**
  | Metric | Predicted Non-Default | Predicted Default |
  |---|---|---|
  | **Actual Non-Default (45,139)** | 31,184 (TN) | 13,955 (FP) |
  | **Actual Default (5,931)** | 1,862 (FN) | 4,069 (TP) |
- **Underwriting Trade-off:** High recall on defaults (68.6%) is prioritized to safeguard capital, with false positives systematically filtered via secondary credit committee reviews.

### 4.5 Explainability Engine (SHAP TreeExplainer)
For every scored applicant, Aegis Risk calculates local Shapley values:
$$\phi_i(f, x) = \sum_{S \subseteq F \setminus \{i\}} \frac{|S|!(|F| - |S| - 1)!}{|F|!} \left[ f_x(S \cup \{i\}) - f_x(S) \right]$$
- **Top-3 Factor Extraction:** Extracts the three features with the highest absolute attribution $$|\phi_i|$$.
- **Directional Categorization:**
  - Positive impact ($$+$$): Increases borrower default probability (rendered in red in the UI).
  - Negative impact ($$-$$): Reduces borrower default probability (rendered in emerald in the UI).
- **Human-Readable Regulatory Translation:** Translates raw coefficients into underwriter explanations (e.g., `DTIRatio` with positive SHAP translates to *"High Debt-to-Income Ratio increases default probability"*).

### 4.6 Model Governance & Demographic Drift Simulation (`scripts/simulate_drift.py`)
To comply with **Federal Reserve SR 11-7** guidelines, the system benchmarks vulnerability to demographic covariate shift:
- **In-Distribution Partition:** Borrowers with `Age < 40` (Model AUC: **0.7448**)
- **Out-of-Distribution Partition:** Borrowers with `Age >= 40` (Model AUC: **0.7099**)
- **Measured Degradation:** **$$\Delta \text{AUC} = 0.0349$$**
- **Outcome:** Proves why static models fail over time and provides mathematical justification for automated continuous monitoring and scheduled retraining pipelines. Results are exported to `ml/drift_report.json` and visualized on `/analytics`.

### 4.7 Model Registry & AWS S3 Synchronization (`scripts/aws_s3_sync.py`)
Provides automated synchronization of local ML artifacts to an Amazon S3 Model Registry bucket (`s3://aegis-risk-model-registry/`):
- `ml/model.pkl` -> `models/v1.0.0/model.pkl`
- `ml/feature_columns.json` -> `models/v1.0.0/feature_columns.json`
- `ml/drift_report.json` -> `audits/drift_report_latest.json`
- `ml/model_card.md` -> `documentation/model_card.md`
- `seed_borrowers.csv` -> `datasets/seed_borrowers.csv`
*(Features automatic fallback to dry-run mode when AWS credentials are not present locally).*

---

## 5. Data Bridge, Synthetic PII & Ingestion Pipeline

### 5.1 Real vs. Simulated Data Policy
To ensure absolute compliance with data privacy standards while preserving empirical machine learning integrity:
- **REAL Elements:** Model training data, predictive mathematical relationships, calibrated risk probabilities, feature importances, and SHAP attribution vectors.
- **SIMULATED Elements:** Personally Identifiable Information (PII) including Borrower Full Names, Synthetic Email Addresses, and Assigned Geographic Regions. These are dynamically generated via the Python `Faker` library.

### 5.2 Seed Preparation (`scripts/prepare_seed_data.py`)
Translates the raw 255k ML dataset into the normalized database schema:
1. Samples 400 representative loan profiles across all four risk tiers.
2. Reverses one-hot encoded columns back into canonical categorical strings:
   - `LoanPurpose_*` -> `loan_type` (`Auto`, `Business`, `Home`, `Personal`)
   - `EmploymentType_*` -> `employment_status` (`Full-time`, `Part-time`, `Self-employed`, `Unemployed`)
3. Synthesizes missing identifiers: `external_id` (`LN-000001` through `LN-000400`), `full_name`, `email`, and `geography`.
4. Derives `monthly_income` ($$\text{Annual Income} / 12$$) and realistic `outstanding_balance`.
5. Executes the trained XGBoost model and SHAP attribution engine against every row, deriving exact `score`, `bucket`, and top-3 `reasons`.
6. Exports normalized CSVs: `seed_borrowers.csv` and `seed_scores_reasons.csv`.

### 5.3 Database Ingestion (`scripts/seed_database.py`)
Automates database seeding via the Supabase Python SDK:
- Connects using `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- Performs batch upsert of 400 borrowers into `borrowers`.
- Upserts corresponding 400 risk scores into `risk_scores` (which triggers PostgreSQL `trg_generate_risk_alert`).
- Chunks and inserts 1,200 ranked SHAP attributions into `risk_reasons` (batches of 200).

---

## 6. Frontend Application & Interactive Underwriting Cockpit

The frontend is built using **Next.js 16 (App Router)**, **Tailwind CSS**, and **Recharts**. It is styled with a financial navy/slate aesthetic designed specifically for institutional credit analysts.

### 6.1 Route Inventory & Features

| Route | Primary Component | Key Capabilities |
|---|---|---|
| `/` | `components/dashboard/overview.tsx` | Executive summary KPIs, concentration distribution charts, quick access to flagged alerts. |
| `/borrowers` | `app/borrowers/page.tsx` | Searchable, paginated portfolio table; risk bucket filter tabs (`All`, `Critical`, `High`, `Medium`, `Low`); **Live New Applicant Credit Scorer Modal**. |
| `/borrowers/[id]` | `app/borrowers/[id]/page.tsx` | Borrower profile overview; **SHAP Horizontal Attribution Bar Chart**; **What-If Scenario Simulator**; **Automated Adverse Action Notice Generator**. |
| `/alerts` | `app/alerts/page.tsx` | Tiered concentration risk triage queue; severity tags; interactive **Acknowledge / Resolve** stateful action buttons. |
| `/analytics` | `app/analytics/page.tsx` | Top-line KPI summary cards; **Expected Loss ($$EL$$) Actuarial Calculator**; **Macroeconomic Stress-Testing Toggle**; **Model Governance & Data Drift Audit**. |
| `/signin` & `/signup`| `app/signin/page.tsx`, `app/signup/page.tsx` | Team session authentication with redirect protection. |

### 6.2 Key Interactive Features

#### 1. Interactive "What-If" Underwriter Scenario Simulator
Located on the Borrower Detail page (`/borrowers/[id]`). Credit officers can dynamically modify underwriting terms:
- **Loan Amount Slider:** Tests lower loan principals ($1,000 to $100,000).
- **Loan Term / Tenure Slider:** Tests loan term extensions (12 to 60 months).
- **Monthly Income Slider:** Tests additional verified income or co-signer additions.
- **Dynamic Recalculation:** Utilizes empirical elasticity coefficients from the XGBoost model to recalculate predicted default probability and risk bucket in real time, turning the system into an active credit restructuring cockpit.

#### 2. Automated "Adverse Action Notice" Generator (CFPB / ECOA Compliance)
When reviewing a high or critical risk applicant on `/borrowers/[id]`, credit officers can click **"Generate Adverse Action Notice"**:
- Renders an official, printable institutional declination letter.
- Populates applicant name, loan ID, date, and institution details.
- Automatically inserts the **top specific adverse factors derived directly from local SHAP values**.
- Includes mandatory statutory disclosures informing the consumer of their credit bureau rights and dispute avenues under the **Equal Credit Opportunity Act (ECOA)** and the **Fair Credit Reporting Act (FCRA)**.

#### 3. Amazon Bedrock GenAI Credit Underwriting Memorandum
Located on `/borrowers/[id]`. Underwriters can click **"Generate AI Credit Memo (AWS Bedrock)"**:
- Dispatches an asynchronous request to Amazon Bedrock Runtime invoking **Claude 3.5 Haiku**.
- Synthesizes borrower Debt-to-Income, financial leverage, and local XGBoost SHAP feature attributions into an institutional-grade Credit Committee Memorandum.
- Delivers a structured four-part narrative: Executive Underwriting Recommendation, Quantitative Risk Decomposition, Stress Considerations, and Model Risk Governance compliance.

#### 4. Live New Applicant Credit Scorer Modal
Accessible from `/borrowers`:
- Allows underwriters to input parameters for prospective applicants on the fly (Name, Loan Type, Loan Amount, Monthly Income, Credit Score, Tenure, Employment).
- Instantly computes probability score, assigns risk bucket, and displays immediate underwriting recommendations (Approved, Manual Review, or Decline).

#### 5. Macroeconomic Stress-Testing & Expected Loss Calculator

Located on `/analytics`:
- **Expected Loss Metric:** Displays portfolio financial exposure in dollars:
  $$\text{Expected Loss (EL)} = \sum_{i} \text{Score}_i \times \text{Balance}_i \times \text{LGD}$$ *(assuming standard institutional LGD = 45%)*.
- **Macro Stress-Test Toggle:** Switches between baseline economic conditions and a **+200 bps Fed Rate Hike / Stagflation Shock** scenario, dynamically elevating risk scores and visualizing portfolio migration to critical buckets.

---

## 7. MassMutual Enterprise Strategy, Compliance & Financial Impact

### 7.1 Regulatory & Governance Alignment

1. **Federal Reserve SR 11-7 (Supervisory Guidance on Model Risk Management):**
   - Aegis Risk provides complete model inventory, documented assumptions, linear baseline comparisons (Logistic Regression), and empirical covariate drift audits.
2. **Equal Credit Opportunity Act (ECOA - Regulation B):**
   - Lenders cannot take adverse action using black-box algorithms without providing specific reasons. Aegis Risk binds local SHAP values directly to compliant adverse action notices.
3. **Fair Credit Reporting Act (FCRA - Regulation V):**
   - Enforces accuracy, transparency, and consumer right to know adverse factors influencing credit decisions.

### 7.2 Enterprise Vocabulary Matrix
Use these institutional definitions during stakeholder presentations:

| Instead of saying... | Say this to MassMutual... | Why It Resonates |
|---|---|---|
| *"We trained an XGBoost model."* | *"We developed a supervised credit risk model calibrated for Probability of Default (PD) scoring."* | Standard institutional banking and actuarial vocabulary. |
| *"We added explainability."* | *"We integrated SHAP local feature attributions to satisfy ECOA and FCRA requirements for adverse action notices."* | Proves understanding of fair lending regulations. |
| *"Accuracy dropped on older users."* | *"Our demographic drift simulation revealed sub-population covariate shift, triggering our automated retraining protocol under SR 11-7 model governance guidelines."* | **SR 11-7** is the industry standard for model validation. |
| *"It runs fast."* | *"Our scoring seam cleanly decouples client-side consumption from the model serving layer, enabling seamless integration with AWS SageMaker Serverless Inference."* | Demonstrates enterprise cloud architecture maturity. |
| *"We made an alerts page."* | *"We implemented a tiered triage queue with stateful acknowledgment workflows to manage concentration risk."* | Mirrors institutional credit monitoring desks. |

### 7.3 Live Demo Pitch Flow (5-Minute Winning Script)

1. **The Executive Problem (30s):** Institutional credit portfolios face hidden concentration risks and non-linear default interactions that legacy FICO scorecards miss.
2. **Portfolio Health & Stress-Testing (60s):** Open the **Overview** & **Analytics** dashboards. Highlight the **$29.8M** monitored balance, the **Expected Loss ($$EL$$)** calculation, and flip the **Macroeconomic Stress-Testing Toggle** (+200 bps Fed Hike) to show risk migration.
3. **Underwriting Deep-Dive (90s):** Navigate to **Borrowers**, filter by `Critical` bucket, and select a borrower. Review their financial profile and explain the **SHAP Horizontal Attribution Bar Chart** ("Why did the model score 0.814? High DTI and short employment").
4. **Active Restructuring & Compliance (60s):** 
   - Adjust the **What-If Scenario Sliders** (extend tenure and reduce principal) to demonstrate how the risk score drops into defensible territory.
   - Click **"Generate Adverse Action Notice"** to reveal the auto-generated CFPB/ECOA compliant denial letter.
5. **Model Governance & S3 Cloud Sync (60s):** Show the **Model Governance & Data Drift Audit** (SR 11-7 age shift) and reference the **AWS S3 Model Registry** sync script.

---

## 8. Setup, Execution & Operations Guide

### 8.1 Prerequisites
- **Node.js:** v18.0.0 or higher
- **Package Manager:** `npm` or `pnpm`
- **Python:** 3.10+ (with virtual environment capability)
- **AWS CLI v2:** Configured for `ap-southeast-2`
- **Database:** Amazon RDS PostgreSQL 16 (Primary) or Supabase (Fallback)

### 8.2 Environment Configuration (`.env`)
Create `.env` or `.env.local` in the project root:
```env
# Amazon RDS PostgreSQL 16 (Primary Managed Database)
DATABASE_URL=postgresql://postgres:password@aegis-risk-db.c1wu2mekybkk.ap-southeast-2.rds.amazonaws.com:5432/postgres

# Supabase Configuration (Operational Fallback)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key

# AWS Cloud Infrastructure (Region: ap-southeast-2, Account: 022671037337)
AWS_REGION=ap-southeast-2
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_S3_BUCKET_NAME=aegis-risk-storage-022671037337
AWS_INFERENCE_ENDPOINT_URL=https://a3q6b9scn0.execute-api.ap-southeast-2.amazonaws.com/
AWS_CLOUDWATCH_LOG_GROUP=/aegis-risk/audit-trail
AWS_CLOUDWATCH_ENABLED=true
AWS_SNS_TOPIC_ARN=arn:aws:sns:ap-southeast-2:022671037337:aegis-risk-critical-alerts

# AWS Cognito Identity & User Pools
NEXT_PUBLIC_AWS_COGNITO_USER_POOL_ID=ap-southeast-2_80G23Am1X
NEXT_PUBLIC_AWS_COGNITO_CLIENT_ID=74120ugqosjjpmup4utltl1oqf

# AWS Step Functions Credit Decisioning (STP)
AWS_STEP_FUNCTIONS_DECISIONING_ARN=arn:aws:states:ap-southeast-2:022671037337:stateMachine:Aegis-Risk-Credit-Decisioning

# Meta WhatsApp Business Cloud API (Simulation mode by default)
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
```

### 8.3 Python Virtual Environment & ML Setup
```powershell
# Windows (PowerShell)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install Dependencies
pip install -r requirements.txt
pip install supabase python-dotenv faker psycopg2-binary
```

### 8.4 Database Migration & Seeding Execution
1. **Primary (Amazon RDS PostgreSQL 16):**
   ```powershell
   python scripts/seed_rds.py
   ```
   *Creates necessary roles, executes DDL migrations, and upserts 400 borrowers, 400 calibrated risk scores, 93 alerts, and 1,200 SHAP reasons.*
2. **Fallback (Supabase Cloud Database):**
   ```powershell
   python scripts/seed_database.py
   ```

### 8.5 Running the Web Application
```powershell
# Install Node packages
npm install

# Start local Next.js development server
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 8.6 Production Build Verification
```powershell
npm run build
npm run start
```

### 8.7 Live AWS Infrastructure Operations
```powershell
# 1. Inspect Amazon RDS Database
aws rds describe-db-instances --db-instance-identifier aegis-risk-db --region ap-southeast-2

# 2. Inspect S3 Model Lake
aws s3 ls s3://aegis-risk-storage-022671037337 --recursive

# 3. Test Live Lambda Scoring
Invoke-RestMethod -Uri "https://a3q6b9scn0.execute-api.ap-southeast-2.amazonaws.com/" -Method Post -ContentType "application/json" -Body '{"borrower_id": "test", "features": {"monthly_income": 5000, "loan_amount": 20000, "tenure_months": 36, "outstanding_balance": 8000}}'

# 4. Trigger AWS Step Functions STP Workflow
aws stepfunctions start-execution --state-machine-arn arn:aws:states:ap-southeast-2:022671037337:stateMachine:Aegis-Risk-Credit-Decisioning --input "{\"borrower_id\": \"LN-000101\", \"features\": {\"monthly_income\": 9388, \"loan_amount\": 92393, \"tenure_months\": 36, \"outstanding_balance\": 73914}}" --region ap-southeast-2

# 5. Read CloudWatch Audit Logs (SR 11-7)
aws logs get-log-events --log-group-name /aegis-risk/audit-trail --log-stream-name underwriter-decisions --region ap-southeast-2
```

---

## 9. Team Roles, Responsibilities & Execution Checklist

| Role | Primary Focus | Core Files & Workflows |
|---|---|---|
| **Person 1: Machine Learning Engineer** | Model Training, Evaluation, SHAP Attribution, Drift Simulation, S3 Model Lake | `scripts/train_model.py`, `scripts/simulate_drift.py`, `scripts/aws_s3_sync.py`, `ml/model.pkl`, `ml/drift_report.json`, `ml/model_card.md` |
| **Person 2: Backend & Infra Engineer** | Amazon RDS PostgreSQL, AWS Cognito, Step Functions STP, Lambda Seam, Bedrock, WhatsApp, CloudWatch, SNS | `lib/db/postgres.ts`, `scripts/seed_rds.py`, `lib/scoring/getScore.ts`, `lib/aws/*`, `app/api/*` |
| **Person 3: Frontend Engineer** | Dashboard Shell, Recharts Visualizations, Underwriting Simulator, Adverse Action Generator, Bedrock Memo & WhatsApp Modals | `app/borrowers/*`, `app/alerts/*`, `app/analytics/*`, `components/dashboard/*`, `lib/types/*` |

### Final Verification Checklist
- [x] XGBoost model trained with class imbalance handling (`scale_pos_weight = 7.61`, AUC 0.7576).
- [x] SHAP values computed and directional impact assigned (+/-).
- [x] Model drift simulated across demographic slices (AUC drop 0.7448 -> 0.7099) and documented.
- [x] AWS S3 Model Lake synchronized with 5/5 verified artifacts.
- [x] Amazon RDS PostgreSQL 16 provisioned, migrated, and seeded with 400 borrowers, 400 scores, 93 alerts, 1,200 SHAP reasons.
- [x] AWS Cognito User Pool configured (`ap-southeast-2_80G23Am1X`) for underwriter SSO.
- [x] AWS Step Functions STP credit decision state machine operational (`Aegis-Risk-Credit-Decisioning`).
- [x] Decoupled scoring seam implemented (`lib/scoring/getScore.ts`) connecting to live AWS Lambda engine.
- [x] Amazon Bedrock Claude 3.5 Haiku GenAI Memo generator operational (`/api/borrowers/:id/memo`).
- [x] Meta WhatsApp Business Cloud API notification dispatch operational (`/api/borrowers/:id/whatsapp`).
- [x] Borrower list equipped with pagination, text search, risk bucket filtering, and live applicant scorer modal.
- [x] Borrower detail view equipped with horizontal SHAP bar chart, What-If loan restructuring sliders, and Adverse Action Notice generator.
- [x] Alerts page equipped with stateful acknowledgment and resolution workflow (`PATCH`).
- [x] Portfolio analytics equipped with Expected Loss actuarial metric and macroeconomic stress-test toggle.
- [x] Amazon CloudWatch audit logging (`/aegis-risk/audit-trail`) and Amazon SNS critical risk alert dispatch operational.
- [x] Production build passes cleanly without errors.

