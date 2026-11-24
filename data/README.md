# Loan Sentry — Production & Reference Datasets Catalog

**System:** Loan Sentry (AI-Powered Institutional Loan Default Prediction & Underwriting Platform)  
**Enterprise Standard:** Federal Reserve SR 11-7, CFPB Regulation B, ECOA, FCRA  
**Location:** `/data`  

This directory contains the complete institutional credit datasets used across the Loan Sentry ecosystem for model training, Out-of-Time (OOT) validation, demographic fairness auditing, concept drift simulation, database seeding, and explainable adverse action reporting.

---

## 1. Dataset Inventory & High-Level Summary

| File Name | Size | Records | Columns | Role & Lifecycle Stage | Target Audience / Consumers |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **`Loan_default_v2.csv`** | `~56.5 MB` | **255,347** | **43** | Primary institutional model training & evaluation cohort | `scripts/train_model.py`, `scripts/simulate_drift.py`, `scripts/audit_fair_lending.py` |
| **`Loan_default_cleaned.csv`** | `~21.8 MB` | **255,347** | **32** | Baseline pre-processed dataset (pre-transformation) | `scripts/realistic_dataset_transform.py` |
| **`seed_borrowers.csv`** | `~80 KB` | **400** | **24** | Stratified realistic institutional applicant profiles | `scripts/seed_database.py`, `scripts/seed_rds.py`, Underwriter Cockpit |
| **`seed_scores_reasons.csv`** | `~69 KB` | **400** | **7** | Calibrated inference outputs & local TreeSHAP factors | `scripts/seed_database.py`, `scripts/seed_rds.py`, Adverse Action Generator |

---

## 2. Dataset 1: `Loan_default_v2.csv` (Primary Production Dataset)

### 2.1 Overview & Provenance
`Loan_default_v2.csv` was engineered to address the critical deficiencies of synthetic and raw public credit datasets (e.g., uniform distributions, zero macroeconomic correlation, and post-origination target leakage). Using `scripts/realistic_dataset_transform.py`, the dataset injects realistic banking correlations derived from Federal Reserve consumer credit distributions, TransUnion delinquency curves, and Fannie Mae historical mortgage performance.

### 2.2 Seasoned Cohort vs. Active Portfolio
- **Total Rows:** `255,347`
- **Seasoned Loan Cohort (`default_label.notna()`):** `168,258` records
  - **Non-Defaults (`0`):** `145,780` (86.64%)
  - **Defaults (`1`):** `22,478` (13.36%)
  - **Imbalance Ratio:** `~6.48 : 1` (handled via `scale_pos_weight = 6.48` in XGBoost)
- **Active / Unseasoned Loans (`default_label.isna()`):** `87,089` records
  - Current performing loans with active repayment tenure (<18 months seasoned). Excluded from supervised default target training to prevent maturity bias.

### 2.3 Temporal Split (Out-of-Time / OOT Validation)
To eliminate temporal lookahead bias, the training pipeline divides the seasoned cohort by `origination_date`:
- **In-Time (IT) Training Set:** Originated on or before `2022-12-31` (`118,529` records)
- **Out-of-Time (OOT) Test Set:** Originated after `2022-12-31` (2023–2024 vintage, `49,729` records)

### 2.4 Complete 43-Column Schema Dictionary

#### A. Demographics & Financial Ratios (Origination)
1. `Age`: Applicant age in years (18–69).
2. `Income`: Annual gross verifiable income ($15,000–$150,000).
3. `LoanAmount`: Principal amount requested ($5,000–$50,000).
4. `CreditScore`: Credit bureau FICO / CIBIL equivalent score (300–850).
5. `MonthsEmployed`: Employment tenure at current employer (0–120 months).
6. `NumCreditLines`: Number of active open revolving & installment lines (1–4).
7. `InterestRate`: Annual Percentage Rate (APR) assigned at pricing (2.0%–25.0%).
8. `LoanTerm`: Amortization schedule in months (36, 48, or 60 months).
9. `DTIRatio`: Debt-to-Income ratio as a decimal fraction (0.10–0.90).

#### B. Categorical Attributes (One-Hot Encoded)
10. `Education_Bachelor's`: Binary flag (`1`/`0`).
11. `Education_High School`: Binary flag (`1`/`0`).
12. `Education_Master's`: Binary flag (`1`/`0`).
13. `Education_PhD`: Binary flag (`1`/`0`).
14. `EmploymentType_Full-time`: Binary flag (`1`/`0`).
15. `EmploymentType_Part-time`: Binary flag (`1`/`0`).
16. `EmploymentType_Self-employed`: Binary flag (`1`/`0`).
17. `EmploymentType_Unemployed`: Binary flag (`1`/`0`).
18. `MaritalStatus_Divorced`: Binary flag (`1`/`0`).
19. `MaritalStatus_Married`: Binary flag (`1`/`0`).
20. `MaritalStatus_Single`: Binary flag (`1`/`0`).
21. `HasMortgage_No`: Binary flag (`1`/`0`).
22. `HasMortgage_Yes`: Binary flag (`1`/`0`).
23. `HasDependents_No`: Binary flag (`1`/`0`).
24. `HasDependents_Yes`: Binary flag (`1`/`0`).
25. `LoanPurpose_Auto`: Loan purpose auto purchase (`1`/`0`).
26. `LoanPurpose_Business`: Loan purpose SME working capital (`1`/`0`).
27. `LoanPurpose_Education`: Loan purpose tuition / education (`1`/`0`).
28. `LoanPurpose_Home`: Loan purpose home improvement / acquisition (`1`/`0`).
29. `LoanPurpose_Other`: Loan purpose debt consolidation / personal (`1`/`0`).
30. `HasCoSigner_No`: Binary flag (`1`/`0`).
31. `HasCoSigner_Yes`: Binary flag (`1`/`0`).

#### C. Bureau Delinquency, Lifecycle & Seasoning Variables (Added in V2)
32. `default_ever`: Lifetime historical default indicator across credit bureau history (`1`/`0`).
33. `outstanding_balance_ratio`: Current unpaid balance divided by original principal (0.0–1.0).
34. `origination_date`: ISO timestamp of loan disbursement (`YYYY-MM-DD`).
35. `observation_date`: ISO timestamp of model observation / vintage snapshot (`YYYY-MM-DD`).
36. `loan_status`: Loan servicing state (`Fully Paid`, `Default`, `Charged Off`, `Current`).
37. `days_past_due`: Current delinquency aging bucket in days (`0`, `30`, `60`, `90+`).
38. `delinquency_count_12m`: Number of 30+ DPD delinquencies reported in preceding 12 months.
39. `num_inquiries_6m`: Hard credit bureau inquiries within past 6 months.
40. `credit_utilization`: Revolving credit card & line utilization ratio (0.05–0.98).
41. `prior_defaults`: Count of lifetime charge-offs or defaults on public records (0–3).
42. `collateral_value`: Appraised liquidation value of pledged asset ($0 for unsecured).
43. `default_label`: Ground-truth binary default outcome (`1.0` = Default/Charge-Off, `0.0` = Paid, `NaN` = Current).

### 2.5 Strict Target Leakage Elimination
Under institutional standards (SR 11-7), post-origination variables (`days_past_due`, `loan_status`, `outstanding_balance_ratio`, `observation_date`) are strictly isolated from the 36-feature inference vector. Training on post-origination state creates artificial 100% predictive accuracy that catastrophic collapses in production.

---

## 3. Dataset 2: `Loan_default_cleaned.csv` (Baseline Raw Dataset)

### 3.1 Overview
`Loan_default_cleaned.csv` is the 32-column baseline dataset originally pre-processed from Kaggle / open-source credit benchmark records.
- **Records:** `255,347`
- **Columns:** 32 (Numerical features, one-hot encoded categories, and synthetic `Default` target column).
- **Role:** Serves as the immutable input file for `scripts/realistic_dataset_transform.py` to reproduce or re-parameterize `Loan_default_v2.csv`.

---

## 4. Dataset 3: `seed_borrowers.csv` (Institutional Ingestion Cohort)

### 4.1 Overview
`seed_borrowers.csv` contains 400 carefully stratified borrower profiles sampled from `Loan_default_v2.csv` by `scripts/prepare_seed_data.py`. It bridges model features with realistic customer demographic identities for application UI rendering and database seeding.

### 4.2 24-Column Schema
- `id`: Unique UUIDv4 identifier (primary key in `borrowers` table).
- `full_name`: Synthesized realistic applicant name.
- `email`: Synthesized contact email for notification workflows.
- `age`: Applicant age (years).
- `income`: Gross annual income ($).
- `loan_amount`: Requested loan amount ($).
- `credit_score`: Bureau credit score (300–850).
- `months_employed`: Employment tenure (months).
- `num_credit_lines`: Active credit trade lines.
- `interest_rate`: Quoted interest rate (%).
- `loan_term`: Amortization tenure (months).
- `dti_ratio`: Debt-to-income ratio.
- `education`: Decoded string (`High School`, `Bachelor's`, `Master's`, `PhD`).
- `employment_type`: Decoded string (`Full-time`, `Part-time`, `Self-employed`, `Unemployed`).
- `marital_status`: Decoded string (`Single`, `Married`, `Divorced`).
- `has_mortgage`: Boolean indicator (`Yes` / `No`).
- `has_dependents`: Boolean indicator (`Yes` / `No`).
- `loan_purpose`: Decoded string (`Auto`, `Business`, `Education`, `Home`, `Other`).
- `has_cosigner`: Boolean indicator (`Yes` / `No`).
- `credit_utilization`: Revolving utilization fraction.
- `delinquency_count_12m`: Delinquency events in past 12 months.
- `num_inquiries_6m`: Hard bureau inquiries in past 6 months.
- `prior_defaults`: Lifetime prior default count.
- `collateral_value`: Pledged collateral valuation ($).

### 4.3 Database Target
Directly ingested into Supabase / AWS RDS PostgreSQL `borrowers` table via:
```bash
python scripts/seed_database.py   # Supabase
python scripts/seed_rds.py        # AWS RDS PostgreSQL
```

---

## 5. Dataset 4: `seed_scores_reasons.csv` (Explainability & TreeSHAP Output)

### 5.1 Overview
`seed_scores_reasons.csv` contains the pre-computed, deterministic model inference results for the 400 seed borrowers. It couples calibrated default probabilities with local TreeSHAP feature attributions and compliance decline reasons.

### 5.2 7-Column Schema
- `borrower_id`: Foreign key matching `id` in `seed_borrowers.csv`.
- `risk_score`: Calibrated default probability score ($P(\text{Default}) \in [0.0, 1.0]$).
- `top_reasons`: Semicolon-separated plain English adverse action factors (e.g. `Elevated Debt-to-Income (DTI); Severe Subprime Credit Score; Recent Credit Bureau Inquiries`).
- `shap_age`: Local TreeSHAP log-odds attribution for `Age`.
- `shap_income`: Local TreeSHAP log-odds attribution for `Income`.
- `shap_dti`: Local TreeSHAP log-odds attribution for `DTIRatio`.
- `shap_credit_score`: Local TreeSHAP log-odds attribution for `CreditScore`.

### 5.3 Compliance Role
Directly powers:
1. **Underwriter Cockpit Risk Gauges:** Categorization into `Low` (<20%), `Medium` (20–45%), `High` (45–70%), and `Critical` (>70%).
2. **Automated Adverse Action Notice Generator:** Generates CFPB/ECOA legally compliant decline letters with Top 3 adverse factors.
3. **What-If Scenario Simulator:** Interactive slider sensitivity benchmarks.

---

## 6. How to Use These Datasets

All pipeline scripts in `/scripts` automatically detect datasets in `data/` with fallback to the root directory.

### Train Production XGBoost Model & Platt Calibrator
```bash
python scripts/train_model.py
```
*Outputs: `ml/model.pkl`, `ml/model.json`, `ml/calibrator.pkl`, `ml/feature_columns.json`*

### Run Fair Lending & ECOA Disparate Impact Audit
```bash
python scripts/audit_fair_lending.py
```
*Outputs: `ml/fair_lending_audit.json` (Four-Fifths Rule compliance metrics)*

### Simulate Demographic & Economic Drift
```bash
python scripts/simulate_drift.py
```
*Outputs: `ml/drift_report.json` (AUC delta, divergence metrics, sensitivity test)*

### Regenerate Seed Cohorts with Fresh TreeSHAP Vectors
```bash
python scripts/prepare_seed_data.py
```
*Outputs: `data/seed_borrowers.csv`, `data/seed_scores_reasons.csv`*

### Ingest Data into Supabase or AWS RDS
```bash
python scripts/seed_database.py   # Ingest to Supabase
python scripts/seed_rds.py        # Ingest to AWS RDS PostgreSQL
```

---

## 7. Institutional Governance & Data Integrity Verification

- **SHA-256 Checksums:** Maintained in CI/CD pipeline for data drift tracking.
- **Privacy:** `seed_borrowers.csv` contains purely synthesized demographic PII; no real borrower identifiers exist in this repository.
- **Git LFS / Storage:** Production CSV artifacts are tracked directly or mirrored to Amazon S3 model artifact lake (`s3://loan-sentry-model-artifacts-ap-southeast-2/datasets/`).
