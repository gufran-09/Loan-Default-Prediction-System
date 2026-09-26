# Aegis Risk: Master Project Guide & 3-Member Team Concept Division

> **Document Location:** This is an executive summary and quick-reference copy. The full detailed documentation is saved at [docs/TEAM_PROJECT_GUIDE.md](file:///d:/Java-%20Backend/Project/Mass%20Mutual/ai-powered-loan-default-prediction-system/docs/TEAM_PROJECT_GUIDE.md).

---

## 1. What is this Project & What Have We Built?

**Aegis Risk** is an automated credit risk underwriting system that transforms loan approval from a slow, manual process taking days into a **real-time, transparent decision cockpit**.

### How Does a Loan Get Approved? (End-to-End Workflow)
1. **Application Intake:** Borrower submits loan terms ($), income, debt, collateral, and credit bureau telemetry (`delinquency_count_12m`, `credit_utilization`, `num_inquiries_6m`, `prior_defaults`).
2. **Fair Lending Guardrail (ECOA/CFPB):** Protected demographics (`Age`, `Gender`, `Race`) are purged from scoring to prevent proxy bias.
3. **Machine Learning Scoring:** Evaluated by a 100-tree **XGBoost model** ($36$ features) calculating calibrated **Probability of Default (PD)** between $0.0$ and $1.0$.
4. **Automated Risk Tiering:**
   - **Low Risk ($PD < 0.30$):** **Auto-Approved** via Straight-Through Processing (STP).
   - **Medium Risk ($0.30 \le PD < 0.60$):** Conditional approval; routed for underwriter review.
   - **High Risk ($0.60 \le PD < 0.85$):** Underwriter uses the **What-If Simulator** to restructure terms (extending tenure, adding collateral) to bring the loan into approval range.
   - **Critical Risk ($PD \ge 0.85$):** Denied automatically; generates a CFPB-compliant **Adverse Action Notice** citing exact **TreeSHAP** reasons.
5. **AI Credit Memo Generation:** Credit committee memorandum generated in 3 seconds via **Amazon Bedrock (Claude 3.5 Haiku)**.

---

## 2. 3-Member Concept Division (Who Presents What)

### 👤 Member 1: Machine Learning, Explainability (XAI) & Fair Lending Compliance
* **Key Topics:**
  * 100-Tree XGBoost Model (`ml/model.json`, `ml/model.pkl`, `lib/scoring/xgboostPredict.ts`).
  * 36 Input Features (DTI, Delinquencies, Utilization, Inquiries, Collateral).
  * TreeSHAP & LIME local feature attributions (why the loan was approved/rejected).
  * Top-3 Drivers: Delinquencies (#1), Credit Utilization (#2), Inquiries (#3).
  * ECOA / CFPB Fair Lending Compliance: Purging Age, Gender, and Race from scoring.
* **Speaking Line:** *"I owned the core risk modeling and explainability layer. I implemented the 36-feature XGBoost model and TreeSHAP attribution engine, ensuring every credit decision is mathematically explainable and compliant with federal fair-lending laws."*

---

### 👤 Member 2: Backend Architecture, Database, Resilience & AWS Cloud Infrastructure
* **Key Topics:**
  * Next.js API Routes (`/api/borrowers`, `/api/borrowers/[id]/rescore`, `/api/telemetry`).
  * Zod Schema Validation & Data Normalization (`lib/validation/schemas.ts`, `lib/scoring/getScore.ts`).
  * Dual PostgreSQL Database Schema (Amazon RDS + Supabase fallback).
  * AWS Serverless: AWS Lambda, API Gateway, and AWS Step Functions for STP routing.
  * System Resilience: Circuit Breaker pattern and Sliding Window Rate Limiting.
* **Speaking Line:** *"I designed the backend infrastructure, database schema, and AWS cloud orchestration. I built high-throughput Next.js APIs validated by strict Zod schemas, configured PostgreSQL audit trails for regulatory compliance, and implemented production circuit breakers to guarantee system uptime."*

---

### 👤 Member 3: Underwriting Experience, GenAI Integration & Financial Analytics
* **Key Topics:**
  * Financial Underwriting Cockpit (`app/borrowers/page.tsx`, `app/borrowers/[id]/page.tsx`).
  * Interactive **"What-If" Scenario Simulator** (dynamically restructuring loan parameters).
  * Automated **Adverse Action Notice Generator** (CFPB-compliant rejection letters).
  * **Amazon Bedrock GenAI (Claude 3.5 Haiku)** integration for instant Credit Memos.
  * Actuarial Metrics: Portfolio Expected Loss ($\text{EL} = \text{PD} \times \text{EAD} \times \text{LGD}$) and Macro Stress-Testing.
* **Speaking Line:** *"I built the underwriter cockpit, decision-support tools, and GenAI integrations. I created the What-If Simulator to help underwriters restructure high-risk loans, automated compliance with printable Adverse Action Notices, and integrated Amazon Bedrock to generate executive credit memos in under three seconds."*

---

## 3. Quick Run Instructions
```bash
npm install
npm test      # Runs all 5 automated unit tests
npm run dev   # Starts app at http://localhost:3000
```
