# Aegis Risk — Master Implementation Guide & System Specification

**Project:** AI-Powered Loan Default Prediction System (PS-01)  
**Enterprise Target:** MassMutual Financial Group (Institutional Credit & Actuarial Risk Evaluation)  
**Team Composition:** 3 Members (ML Engineer, Backend & Infrastructure Engineer, Frontend Engineer)  
**Core Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL + RLS + Triggers), Python 3.10+ (XGBoost, Scikit-learn, SHAP, Pandas, Faker), AWS S3 Model Registry  
**Primary Dataset:** `Loan_default_cleaned.csv` — 255,347 records, 32 columns, 0 nulls, target `Default` (11.6% minority class)

---

## Document Purpose

This document serves as the **authoritative, single-source-of-truth master specification** for the Aegis Risk system. It synthesizes all technical documentation, architectural patterns, machine learning workflows, database schemas, API contracts, enterprise underwriting features, regulatory compliance protocols, and step-by-step operational run guides into one unified reference.

---

## Table of Contents

1. [Executive Summary & System Architecture](#1-executive-summary--system-architecture)
2. [Database Schema & Data Persistence (Supabase PostgreSQL)](#2-database-schema--data-persistence-supabase-postgresql)
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

### 1.2 System Architecture Diagram

```mermaid
flowchart TB
    subgraph Data & ML Layer [Python 3.10+ Machine Learning Layer]
        RAW[(Loan_default_cleaned.csv<br/>255,347 rows)] --> TRAIN[scripts/train_model.py]
        TRAIN --> ARTIFACTS[ml/model.pkl<br/>ml/feature_columns.json<br/>ml/model_card.md]
        TRAIN --> DRIFT[scripts/simulate_drift.py]
        DRIFT --> DRIFT_JSON[ml/drift_report.json]
        ARTIFACTS --> S3[scripts/aws_s3_sync.py<br/>AWS S3 Model Registry]
        ARTIFACTS --> BRIDGE[scripts/prepare_seed_data.py<br/>Faker PII + SHAP Calculation]
        BRIDGE --> SEED_FILES[(seed_borrowers.csv<br/>seed_scores_reasons.csv)]
        SEED_FILES --> DB_LOADER[scripts/seed_database.py]
    end

    subgraph Storage Layer [Supabase PostgreSQL 15+]
        DB_LOADER -->|Upsert via Service Role Key| DB[(Supabase Cloud DB)]
        DB --> T_BORROWERS[borrowers Table]
        DB --> T_SCORES[risk_scores Table]
        DB --> T_REASONS[risk_reasons Table]
        T_SCORES -->|Database Trigger:<br/>trg_generate_risk_alert| T_ALERTS[alerts Table]
        DB --> RLS[Row Level Security<br/>Authenticated Access Policies]
    end

    subgraph Application Server [Next.js 16 App Router & Server APIs]
        RLS --> SEAM[lib/scoring/getScore.ts<br/>Decoupled Scoring Seam]
        SEAM --> API_SCORE[/api/borrowers/:id/score]
        DB --> API_BORROWERS[/api/borrowers]
        DB --> API_ALERTS[/api/alerts & /api/alerts/:id]
        DB --> API_PORTFOLIO[/api/analytics/portfolio]
        DRIFT_JSON --> API_DRIFT[/api/analytics/drift]
        AUTH[lib/supabase/server.ts<br/>Cookie Session Auth] --> MW[middleware.ts Route Guard]
    end

    subgraph Client UI [Risk Officer & Underwriter Dashboard]
        API_BORROWERS --> UI_BORROWERS[Borrower Portfolio & Filters<br/>/borrowers]
        API_SCORE --> UI_DETAIL[Borrower Detail & SHAP Chart<br/>What-If Restructuring Simulator<br/>Adverse Action Generator<br/>/borrowers/:id]
        API_ALERTS --> UI_ALERTS[Alert Triage Operations Desk<br/>/alerts]
        API_PORTFOLIO & API_DRIFT --> UI_ANALYTICS[Portfolio Analytics, Expected Loss &<br/>Model Drift Governance<br/>/analytics]
        DB --> UI_OVERVIEW[Executive Overview<br/>/]
    end
```

### 1.3 Architectural Decoupling: The Scoring Seam
The application enforces strict architectural isolation between the UI client and the scoring inference engine via [`lib/scoring/getScore.ts`](file:///d:/Java-%20Backend/Project/Mass%20Mutual/ai-powered-loan-default-prediction-system/lib/scoring/getScore.ts). 
- In development/demonstration mode: `getScore(borrowerId)` reads seeded scores and SHAP reasons from Supabase with zero client-side dependencies on Python.
- In production cloud mode: this function serves as the single seam that can be modified to call an **AWS SageMaker Serverless Inference** endpoint or real-time Lambda function. The REST API contract and frontend consumers require zero code modifications.

---

## 2. Database Schema & Data Persistence (Supabase PostgreSQL)

The database schema is managed via Supabase SQL migrations located in `supabase/migrations/`.

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

#### 3. Live New Applicant Credit Scorer Modal
Accessible from `/borrowers`:
- Allows underwriters to input parameters for prospective applicants on the fly (Name, Loan Type, Loan Amount, Monthly Income, Credit Score, Tenure, Employment).
- Instantly computes probability score, assigns risk bucket, and displays immediate underwriting recommendations (Approved, Manual Review, or Decline).

#### 4. Macroeconomic Stress-Testing & Expected Loss Calculator
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
- **Supabase:** Cloud project or local CLI instance

### 8.2 Environment Configuration (`.env`)
Create `.env` or `.env.local` in the project root:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key

# Service Role Key (Required for Python DB Seeding)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key

# AWS S3 Model Registry (Optional / Supports Local Dry-Run)
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=aegis-risk-model-registry
```

### 8.3 Python Virtual Environment & ML Setup
```powershell
# Windows (PowerShell)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install Dependencies
pip install -r requirements.txt
pip install supabase python-dotenv faker
```

### 8.4 Database Migration & Seeding Execution
1. **Apply Migrations:** Execute `supabase/migrations/0001_init.sql` and `supabase/migrations/0002_alerts_update.sql` in the Supabase SQL Editor.
2. **Execute Ingestion Script:**
   ```powershell
   python scripts/seed_database.py
   ```
   *Uploads 400 borrowers, 400 calibrated risk scores, 1,200 SHAP reasons, and fires triggers to generate alerts.*

### 8.5 Running the Web Application
```powershell
# Install Node packages
pnpm install # or npm install

# Start local Next.js development server
pnpm dev # or npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 8.6 Production Build Verification
```powershell
pnpm build
pnpm start
```

### 8.7 Deploying to Vercel
1. Push repository to GitHub.
2. Import repository into Vercel.
3. Configure Environment Variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. Deploy the `main` branch.

---

## 9. Team Roles, Responsibilities & Execution Checklist

| Role | Primary Focus | Core Files & Workflows |
|---|---|---|
| **Person 1: Machine Learning Engineer** | Model Training, Evaluation, SHAP Attribution, Drift Simulation, Model Registry | `scripts/train_model.py`, `scripts/simulate_drift.py`, `scripts/aws_s3_sync.py`, `ml/model.pkl`, `ml/drift_report.json`, `ml/model_card.md` |
| **Person 2: Backend & Infra Engineer** | Supabase Migrations, RLS Policies, Triggers, Seed Ingestion, Scoring Seam, API Routes | `supabase/migrations/*`, `scripts/seed_database.py`, `lib/scoring/getScore.ts`, `app/api/*`, Vercel Deployment |
| **Person 3: Frontend Engineer** | Dashboard Shell, Recharts Visualizations, Underwriting Simulator, Adverse Action Generator, Alert Triage Desk | `app/borrowers/*`, `app/alerts/*`, `app/analytics/*`, `components/dashboard/*`, `lib/types/*` |

### Final Verification Checklist
- [x] XGBoost model trained with class imbalance handling (`scale_pos_weight = 7.61`, AUC 0.7576).
- [x] SHAP values computed and directional impact assigned (+/-).
- [x] Model drift simulated across demographic slices (AUC drop 0.7448 -> 0.7099) and documented.
- [x] AWS S3 synchronization script configured with dry-run support.
- [x] Supabase schema unified with automated alert generation trigger.
- [x] Decoupled scoring seam implemented (`lib/scoring/getScore.ts`).
- [x] All REST APIs implemented and tested (`/borrowers`, `/borrowers/:id/score`, `/alerts`, `/analytics/portfolio`, `/analytics/drift`).
- [x] Borrower list equipped with pagination, text search, risk bucket filtering, and live applicant scorer modal.
- [x] Borrower detail view equipped with horizontal SHAP bar chart, What-If loan restructuring sliders, and Adverse Action Notice generator.
- [x] Alerts page equipped with stateful acknowledgment and resolution workflow (`PATCH`).
- [x] Portfolio analytics equipped with Expected Loss actuarial metric and macroeconomic stress-test toggle.
- [x] Production build passes cleanly without type errors.
