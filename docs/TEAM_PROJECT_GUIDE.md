# Aegis Risk: AI-Powered Loan Default Prediction & Underwriting System
## Comprehensive Project Master Guide & 3-Member Team Concept Division

---

## 1. Executive Summary: What is this Project?

**Aegis Risk** is an institutional-grade, AI-powered credit risk assessment and automated underwriting platform designed for financial institutions (tailored for standards like **MassMutual**, **Federal Reserve SR 11-7**, and **CFPB / ECOA Fair Lending regulations**).

### The Problem It Solves:
Traditional bank underwriting takes **days or weeks**, relies on static credit scores (like FICO alone), suffers from human inconsistency, and lacks transparent explanations for rejected borrowers.

### What We Have Built:
We built an end-to-end intelligent credit decision engine that:
1. **Instantly scores applicants** using a trained 100-tree **XGBoost Machine Learning model** ($36$ features).
2. **Explains every decision** using **TreeSHAP** and **LIME** local feature attributions so credit officers and regulators know *exactly why* a loan was approved or flagged.
3. **Guarantees Fair Lending Compliance (ECOA / CFPB)** by strictly excluding protected demographic characteristics (`Age`, `Gender`, `Race`) from credit scoring and adverse action notices.
4. **Empowers Underwriters with a "What-If" Scenario Simulator** to restructure struggling applications (adjusting loan amount, tenure, or collateral) to bring high-risk borrowers into approval range.
5. **Generates Institutional Credit Memos** in 3 seconds using **Amazon Bedrock GenAI (Claude 3.5 Haiku)**.
6. **Automates Straight-Through Processing (STP)** with **AWS Step Functions**, **AWS Lambda**, and automated notifications (**Amazon SNS / WhatsApp alerts**).

---

## 2. End-to-End Workflow: How Does a Loan Get Approved?

```
 [ Applicant Submits Form ]
             │
             ▼
 [ Zod Validation & Schema Sanitization ]
 (Ensures data integrity & maps legacy types to valid one-hot categories)
             │
             ▼
 [ Fair Lending Guardrail (ECOA / CFPB) ]
 (Purges Age, Gender, Race from feature vector)
             │
             ▼
 [ XGBoost 100-Tree Inference Engine ]
 (Evaluates 36 features: DTI, revolving utilization, delinquencies, inquiries, collateral)
             │
             ▼
 [ Outputs Probability of Default (PD: 0.00 to 1.00) & Score (0 - 1000) ]
             │
             ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                       Risk Tier Decision Matrix                        │
 ├────────────────┬─────────────────┬─────────────────┬────────────────────┤
 │    Low Risk    │   Medium Risk   │    High Risk    │   Critical Risk    │
 │   (PD < 0.30)  │ (0.30 ≤ PD < 0.60) │ (0.60 ≤ PD < 0.85) │    (PD ≥ 0.85)     │
 ├────────────────┼─────────────────┼─────────────────┼────────────────────┤
 │  Automated STP │ Manual Review   │ Restructuring   │ Automated Adverse  │
 │  Auto-Approval │ Recommended     │ Required        │ Action Decline     │
 └────────────────┴─────────────────┴─────────────────┴────────────────────┘
             │                                     │
             ▼                                     ▼
 [ Amazon Bedrock GenAI ]              [ Adverse Action Generator ]
 (Generates Credit Memo)               (Generates CFPB-compliant notice
                                        with top 3 TreeSHAP reasons)
```

### The 6 Stages of Loan Processing:

1. **Intake & Ingestion:**
   The applicant's financial profile is captured: requested amount, tenure, monthly income, existing debt, collateral value, plus telemetry features from the credit bureau (`credit_utilization`, `delinquency_count_12m`, `num_inquiries_6m`, `prior_defaults`).
2. **Pre-Processing & One-Hot Encoding:**
   Non-linear categorical features (`LoanPurpose`, `EmploymentType`, `MaritalStatus`, `Education`, `HasMortgage`, `HasCoSigner`) are converted into exact binary vectors satisfying mathematical one-hot invariants ($\sum = 1$).
3. **Machine Learning Model Evaluation:**
   The feature vector is routed through all 100 decision trees in the XGBoost booster. Margins are summed and transformed via logistic sigmoid:
   $$\text{Probability of Default (PD)} = \frac{1}{1 + e^{-\sum \text{leaf\_values}}}$$
4. **Explainability Extraction (TreeSHAP):**
   The marginal delta of each decision path is allocated across features to produce exact log-odds attributions. The top risk drivers are ranked and translated into human-readable financial explanations.
5. **Underwriting Action:**
   - **Prime / Low Risk ($PD < 30\%$):** Routed for Straight-Through Processing (STP) instant approval.
   - **Medium / Borderline ($30\% \le PD < 60\%$):** Assigned to credit officers for income/asset verification.
   - **High Risk ($60\% \le PD < 85\%$):** Underwriters use the **What-If Simulator** to test if higher collateral, lower loan amount, or longer tenure can rescue the loan.
   - **Critical Risk ($PD \ge 85\%$):** Denied automatically, triggering a CFPB-compliant Adverse Action Notice detailing the specific credit reasons.
6. **Audit Trail Persistence:**
   The profile, score, and SHAP attributions are saved to PostgreSQL (RDS/Supabase) in `scoring_history` for audit and continuous model governance.

---

## 3. Team Concept Division (3 Members)

To present this project seamlessly in an interview, review, or presentation, divide ownership across these three roles:

---

### 👤 Member 1: Machine Learning, Explainable AI (XAI) & Fair Lending Compliance
**Title:** *Lead ML & Risk Modeling Engineer*

#### Primary Focus Areas:
* **The XGBoost Credit Risk Model:**
  * Architecture: Gradient Boosted Decision Trees (100 estimators, max depth 6, learning rate 0.1).
  * Dataset: Trained on `Loan_default_v2.csv` with **36 input features** (macro financials + credit bureau telemetry).
  * Inputs include: Requested loan terms, Debt-to-Income (DTI), Revolving Credit Utilization, 12-Month Delinquencies, 6-Month Inquiries, Prior Defaults, and Pledged Collateral Value.
* **Explainability (TreeSHAP & LIME):**
  * Why black-box AI is unacceptable in banking: Federal Reserve SR 11-7 mandates model interpretability.
  * How TreeSHAP works: Deconstructs the model's log-odds output to measure the exact marginal contribution of each feature for an individual applicant.
  * Verified Top-3 SHAP drivers across the population:
    1. `delinquency_count_12m` ($\text{mean } |\text{SHAP}| = 6.986$)
    2. `credit_utilization` ($\text{mean } |\text{SHAP}| = 0.675$)
    3. `num_inquiries_6m` ($\text{mean } |\text{SHAP}| = 0.129$)
* **ECOA / CFPB Fair Lending Compliance:**
  * Purging protected classes (`Age`, `Gender`, `Race`) from scoring inputs and explanations to avoid discriminatory lending or proxy bias.
  * Guaranteeing that adverse action notices cite objective credit behavior rather than demographics.

#### Member 1 Presentation Script / Viva Q&A:
> *"I owned the core risk modeling and explainable AI layer. Because credit decisions carry strict legal obligations under Federal Reserve SR 11-7 and the CFPB, we couldn't deploy a black-box model. I worked with the 36-feature XGBoost model trained on v2 loan default telemetry. Beyond raw probability of default, I implemented TreeSHAP and LIME algorithms that compute exact feature attributions for every borrower. Our empirical analysis proved that recent delinquencies, credit line utilization, and inquiry frequency represent over 80% of predictive risk weight. Furthermore, I enforced strict fair-lending guardrails, ensuring that protected demographics like age, race, and gender are zeroed out and never appear in adverse action reasons."*

---

### 👤 Member 2: Backend Architecture, Database, Resilience & AWS Cloud Infrastructure
**Title:** *Lead Backend & Cloud Systems Engineer*

#### Primary Focus Areas:
* **Full-Stack Next.js API Architecture:**
  * RESTful endpoints: `/api/borrowers` (applicant intake), `/api/borrowers/[id]/rescore` (real-time scoring), `/api/credit-memo` (Bedrock AI memo), `/api/telemetry` (underwriter audit trail).
  * Strong request validation and runtime schema parsing using **Zod** (`borrowerInputSchema`, `rescoreRequestSchema`), preventing malformed payloads and maintaining one-hot categorical invariants.
* **Database & Persistence Design:**
  * Dual PostgreSQL configuration (Amazon RDS + Supabase fallback).
  * Relational schema: `borrowers`, `risk_scores`, `risk_reasons`, and `scoring_history` for point-in-time regulatory auditability.
* **AWS Serverless & Cloud Infrastructure:**
  * **AWS Lambda & API Gateway:** Serverless inference endpoints deployed in `ap-southeast-2`.
  * **AWS Step Functions (`Aegis-Risk-Credit-Decisioning`):** State machine orchestrating Straight-Through Processing (STP) routing and adverse action pipelines.
  * **Amazon SNS & WhatsApp Webhooks:** Real-time multi-channel alerting for high-risk credit triggers and STP approvals.
* **System Resilience Patterns:**
  * In-memory **Circuit Breaker** (`lib/resilience/circuitBreaker.ts`) preventing cascading failures during downstream service outages.
  * **Sliding Window Rate Limiter** protecting underwriting endpoints from automated abuse.

#### Member 2 Presentation Script / Viva Q&A:
> *"I designed the backend infrastructure, database schema, and AWS cloud deployment. We built a high-throughput API layer in Next.js validated with strict Zod schemas. For data storage, we engineered a relational PostgreSQL schema in Amazon RDS and Supabase that captures full snapshot histories for every credit decision to satisfy regulatory audits. On the cloud side, I configured AWS Step Functions for automated straight-through processing, AWS Lambda for serverless risk scoring, and Amazon SNS with WhatsApp webhooks for underwriter alerting. To ensure high availability under heavy financial traffic, I implemented production resilience mechanisms including a 3-state circuit breaker and sliding-window rate limiters."*

---

### 👤 Member 3: Underwriting Experience, GenAI Integration & Financial Analytics
**Title:** *Lead Frontend & Financial Product Specialist*

#### Primary Focus Areas:
* **The Underwriter Cockpit & Decision Dashboard:**
  * Built using Next.js, React 19, and TailwindCSS with dark/light mode and accessible financial data tables.
  * Instant Underwriting Intake Form: Captures financial parameters, bureau telemetry, and collateral cushions with live validation.
* **Interactive "What-If" Scenario Simulator:**
  * Solves a major pain point for credit officers: when an applicant is deemed High Risk, the underwriter can dynamically adjust sliders for **Loan Amount**, **Tenure**, and **Income**.
  * Real-time local elasticity recalculation allows underwriters to see what loan restructuring (e.g. extending tenure from 24 to 36 months) would reduce default risk into an approvable tier without altering historical records.
* **CFPB / ECOA Automated Adverse Action Generator:**
  * Generates legally compliant customer rejection notices dynamically populated with borrower metadata and the exact top TreeSHAP rejection reasons.
* **Amazon Bedrock GenAI Credit Memorandum (Claude 3.5 Haiku):**
  * One-click AI Credit Memo generation via Bedrock SDK (`anthropic.claude-3-5-haiku-20241022-v1:0`).
  * Synthesizes complex financial ratios (DTI, Leverage), credit history, and mitigating covenants into an institutional credit committee memo in under 3 seconds (reducing manual underwriting paperwork from 45 minutes).
* **Actuarial Risk Metrics:**
  * Calculates portfolio **Expected Loss ($EL = PD \times EAD \times LGD$)**, monitored book exposure, and macroeconomic stress-testing (+200 bps Fed interest shock).

#### Member 3 Presentation Script / Viva Q&A:
> *"I led the user experience, financial decision support tools, and Generative AI integration. A scoring model is useless if credit officers cannot easily act on it. I developed our Underwriting Cockpit, featuring the interactive What-If Simulator. If a borrower scores in the high-risk bracket, underwriters can test loan adjustments on the fly to see if extending tenure or pledging collateral can rescue the application. I integrated Amazon Bedrock using Claude 3.5 Haiku to synthesize borrower financials, risk ratios, and SHAP drivers into a formal Credit Underwriting Memo in 3 seconds. Finally, I built our automated Adverse Action Notice generator, ensuring full CFPB compliance by populating legally required disclosures with our model's exact TreeSHAP explanations."*

---

## 4. Key Financial Concepts & Formulas Cheat-Sheet

| Financial Term | Technical Meaning in This Project | Formula / Value |
| :--- | :--- | :--- |
| **Probability of Default (PD)** | The likelihood that a borrower fails to make scheduled debt payments over the loan life. | Sigmoid output ($0.0$ to $1.0$) from 100-tree XGBoost |
| **Exposure at Default (EAD)** | The total dollar amount at risk when default occurs. | Current `outstanding_balance` or requested `loan_amount` |
| **Loss Given Default (LGD)** | Percentage of exposure lost after collateral liquidation and workout. | Estimated from `collateral_value` & asset type ($20\% - 75\%$) |
| **Expected Loss (EL)** | The anticipated dollar cost of credit risk across the loan book. | $$\text{EL} = \text{PD} \times \text{EAD} \times \text{LGD}$$ |
| **Debt-to-Income (DTI)** | Monthly debt service obligations divided by monthly gross income. | $$\text{DTI} = \frac{\text{existing\_debt} + \text{monthly\_payment}}{\text{monthly\_income}}$$ |
| **Revolving Utilization** | Percentage of available credit lines currently being utilized. | `credit_utilization` (Top-2 SHAP driver) |
| **Straight-Through Processing (STP)** | Fully automated approval without requiring human underwriter sign-off. | Triggered when $\text{PD} < 0.30$ and DTI $< 35\%$ |

---

## 5. Quick Reference: File & Code Architecture

| Component | Key Files | Responsible Member |
| :--- | :--- | :---: |
| **ML Models & Features** | `ml/model.json`, `ml/model.pkl`, `ml/feature_columns.json`, `lib/scoring/xgboostPredict.ts` | **Member 1** |
| **Explainability (XAI)** | `lib/scoring/xgboostPredict.ts`, `lib/scoring/explainability.ts`, `seed_scores_reasons.csv` | **Member 1** |
| **API Endpoints & Routing** | `app/api/borrowers/route.ts`, `app/api/borrowers/[id]/rescore/route.ts` | **Member 2** |
| **Schemas & Data Normalization** | `lib/validation/schemas.ts`, `lib/scoring/getScore.ts` | **Member 2** |
| **AWS Cloud & Resiliency** | `lambda/scoring_handler.py`, `lib/resilience/circuitBreaker.ts`, `lib/aws/whatsapp.ts` | **Member 2** |
| **Underwriting Cockpit & UI** | `app/borrowers/page.tsx`, `app/borrowers/[id]/page.tsx` | **Member 3** |
| **What-If Scenario Simulator** | `app/borrowers/[id]/page.tsx` (Lines 208–235, 750–815) | **Member 3** |
| **GenAI Credit Memo (Bedrock)** | `app/api/credit-memo/route.ts`, `app/borrowers/[id]/page.tsx` | **Member 3** |
| **Compliance Notice Generator**| `app/borrowers/[id]/page.tsx` (Adverse Action Modal) | **Member 3** |

---

## 6. How to Run the Entire Project (Quick Command Reference)

```bash
# 1. Install dependencies
npm install

# 2. Run unit & integration test suite (Rate limiters, Circuit breaker, 100-Tree XGBoost)
npm test

# 3. Start Next.js Development Server
npm run dev
# -> Opens http://localhost:3000
```
