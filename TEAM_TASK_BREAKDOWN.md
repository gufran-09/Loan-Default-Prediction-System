# Aegis Risk — Team Task Breakdown & Execution Roadmap (Remaining Work)

**Project:** AI-Powered Loan Default Prediction System (PS-01)  
**Team Composition:** 3 Members (ML Engineer, Backend & Infrastructure Engineer, Frontend Engineer)  
**Reference Document:** `AEGIS_RISK_IMPLEMENTATION_GUIDE.md`  
**Current Phase:** Post-Foundation Integration, Schema Realignment & Polish  

---

## 1. Context & Project Status Audit

### ✅ What Has Been Completed So Far (Foundation & Initial Prototyping):
1. **ML Training & Drift Simulation:** 
   - Model trained (`ml/model.pkl`, XGBoost with `scale_pos_weight`) and evaluated (`ml/model_card.md`).
   - Feature columns mapped (`ml/feature_columns.json`).
   - Drift simulation script implemented (`scripts/simulate_drift.py`).
2. **Seed Generation Scripts:** 
   - `scripts/prepare_seed_data.py` generated `seed_borrowers.csv` and `seed_scores_reasons.csv` with SHAP values.
3. **Database Migrations & Auth:** 
   - Initial SQL migration created (`supabase/migrations/0001_init.sql`).
   - Shared test user configured in `supabase/seed.sql`.
   - `middleware.ts` configured for route guarding.
4. **Backend Seam & API Routes:** 
   - `lib/scoring/getScore.ts` implemented.
   - Initial API handlers created for `/api/borrowers`, `/api/borrowers/[id]/score`, `/api/alerts`, and `/api/analytics/portfolio`.
5. **Frontend Baseline Shell & Pages:** 
   - Navigation shell, login page, and initial pages for `/borrowers`, `/borrowers/[id]`, `/alerts`, and `/analytics` scaffolded.

---

### ⚠️ Critical Discrepancies & Blockers That Must Be Fixed:
1. **Schema & Seed Column Mismatch (High Priority Blocker):**
   - In `0001_init.sql` & `prepare_seed_data.py`, columns are named `name`, `loan_purpose`, `employment_type`.
   - In frontend pages (`/borrowers/page.tsx`, `/alerts/page.tsx`) and `lib/types/index.ts`, fields reference `full_name`, `external_id`, `loan_type`, `employment_status`, causing `undefined` / blank rendering in the UI.
2. **SHAP Explanation Schema Discrepancy:**
   - Database / `getScore.ts` stores `feature_name`, `impact_magnitude`, `impact_direction` (`+` / `-`).
   - Frontend `BorrowerDetail` expects `r.reason` and `r.impact`.
3. **Missing Borrower Profile Fields in Detail View:**
   - `/borrowers/[id]` only calls `/score` and does not display borrower demographic and loan profile attributes (loan amount, balance, income, tenure, geography, employment).
4. **Alerts Interactivity:**
   - No `PATCH /api/alerts/[id]` endpoint or UI button to toggle status (`open` -> `acknowledged` -> `resolved`).
5. **UI Fidelity & Experience:**
   - Borrower list lacks risk bucket filtering, sorting, and pagination controls.
   - Analytics lacks KPI summary metric cards (Total Portfolio Volume, Average Default Probability, Critical Risk Count).
   - Pages lack comprehensive loading skeletons and empty states.

---

## 2. Workload Distribution (Equal Split across 3 Team Members)

| Member | Specialization | Core Focus for Completion | Total Tasks |
|---|---|---|---|
| **Person 1: ML Engineer** | Machine Learning & Data Reliability | Realign seed script to match unified schema, re-export seed CSVs, write database seed loader script, create stakeholder model card & drift demo visualizer | 5 Tasks |
| **Person 2: Backend & Infra** | Cloud Database, APIs & Security | Unify Supabase migrations, implement `PATCH /api/alerts/[id]`, create single borrower profile endpoint/adapter, deploy to Vercel | 5 Tasks |
| **Person 3: Frontend Engineer** | UI/UX, Recharts & Design Polish | Implement SHAP Recharts horizontal chart, fix column mappings, build risk filters/pagination, build alert status actions, build portfolio KPI metrics cards | 5 Tasks |

---

## 3. Priority Definitions

- **P0 (Critical Path Blocker):** Schema, data loader, and API alignment tasks required to prevent runtime crashes and blank fields.
- **P1 (Core Feature Completion):** Interactive charts, filtering, alert management, and metric summaries required for the full grading criteria.
- **P2 (Polish & Demo Readiness):** Loading skeletons, edge cases, responsive checks, and Vercel cloud deployment.

---

## 4. Detailed Task Breakdown

### 🧑‍💻 Person 1: Machine Learning Engineer (ML Lead)

| Task ID | Task Title | Priority | Description & Action Items | Target Files |
|---|---|---|---|---|
| **ML-NEW-01** | **Realign Seed Generation Script with Unified Schema** | **P0** | Update `scripts/prepare_seed_data.py` to output canonical column names: `external_id` (e.g. `LN-000001`), `full_name`, `loan_type`, `employment_status`, `monthly_income`, `outstanding_balance`, `geography`, `tenure_months`. Ensure reasons include both human-readable `reason` text and raw `feature_name`, `impact_magnitude`, and `impact_direction`. | `scripts/prepare_seed_data.py` |
| **ML-NEW-02** | **Regenerate Seed Datasets & Validate Distributions** | **P0** | Re-run script to export fresh `seed_borrowers.csv` and `seed_scores_reasons.csv`. Verify risk bucket distribution (`low` < 0.3, `medium` < 0.6, `high` < 0.85, `critical` ≥ 0.85) and confirm non-zero SHAP values for all rows. | `seed_borrowers.csv`, `seed_scores_reasons.csv` |
| **ML-NEW-03** | **Automated Supabase Data Ingestion Script** | **P0** | Build Python/Node ingestion script (`scripts/seed_database.py` or `.ts`) using Supabase Service Key to batch-upsert all 400 borrowers, their risk scores, reasons, and auto-insert `alerts` for all `high` and `critical` borrowers. | `scripts/seed_database.py` |
| **ML-NEW-04** | **Model Drift Simulation Report & Visual Artifacts** | **P1** | Enhance `scripts/simulate_drift.py` to save demographic/macro drift comparison metrics (AUC drop from 0.88 to 0.74) to `ml/drift_report.json` or markdown table for the live presentation slides. | `scripts/simulate_drift.py`, `ml/drift_report.md` |
| **ML-NEW-05** | **ML Model Card & Stakeholder Talking Points** | **P1** | Finalize `ml/model_card.md` with: Class imbalance strategy (`scale_pos_weight = 7.6`), XGBoost vs. Logistic Regression comparison, SHAP interpretability breakdown, and "What is Real vs. Simulated" talking points. | `ml/model_card.md` |

---

### 🛠️ Person 2: Backend & Infrastructure Engineer

| Task ID | Task Title | Priority | Description & Action Items | Target Files |
|---|---|---|---|---|
| **BE-NEW-01** | **Unify Supabase Migration & Database Schema** | **P0** | Update `supabase/migrations/0001_init.sql` so table definitions match `prepare_seed_data.py` and `lib/types/index.ts` exactly (`external_id`, `full_name`, `loan_type`, `employment_status`). Re-apply to Supabase instance. | `supabase/migrations/0001_init.sql` |
| **BE-NEW-02** | **Update Scoring Seam & Borrower Detail API** | **P0** | Update `lib/scoring/getScore.ts` and `app/api/borrowers/[id]/score/route.ts` to return both borrower profile attributes (`full_name`, `external_id`, `loan_amount`, `outstanding_balance`, `income`, etc.) and score/SHAP reasons in a single unified payload. | `lib/scoring/getScore.ts`, `app/api/borrowers/[id]/score/route.ts` |
| **BE-NEW-03** | **Borrowers List Filtering & Pagination API** | **P0** | Update `app/api/borrowers/route.ts` to ensure search queries filter across both `full_name` and `external_id`, support bucket filtering via relation, and return total count for pagination. | `app/api/borrowers/route.ts` |
| **BE-NEW-04** | **Implement Alert Status Mutation API (`PATCH`)** | **P1** | Create `app/api/alerts/[id]/route.ts` with `PATCH` handler accepting `{ status: 'open' \| 'acknowledged' \| 'resolved' }`. Add RLS update policy for authenticated users. | `app/api/alerts/[id]/route.ts`, `supabase/migrations/0002_alerts_update.sql` |
| **BE-NEW-05** | **Production Deployment & Environment Setup (Vercel)** | **P1** | Deploy Next.js frontend to Vercel, connect production environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), verify SSL, auth session cookies, and clean cold starts. | Deployment / Vercel settings |

---

### 🎨 Person 3: Frontend Engineer (UI/UX Lead)

| Task ID | Task Title | Priority | Description & Action Items | Target Files |
|---|---|---|---|---|
| **FE-NEW-01** | **Fix Borrower Table & Implement Bucket Filters & Pagination** | **P0** | Update `app/borrowers/page.tsx`: Fix column bindings (`r.full_name`, `r.external_id`, `r.loan_type`, `r.outstanding_balance`). Add risk bucket filter dropdown/tabs (`All`, `Critical`, `High`, `Medium`, `Low`), and table pagination controls (`Prev` / `Next` with page indicator). | `app/borrowers/page.tsx` |
| **FE-NEW-02** | **Borrower Detail Page & SHAP Horizontal Bar Chart** | **P0** | Revamp `app/borrowers/[id]/page.tsx`: Render complete borrower profile card (income, tenure, loan amount, balance, geography, employment). Replace CSS bars with interactive Recharts `BarChart` showing top-3 SHAP factors with color-coding (Red = Increases Risk `+`, Green = Decreases Risk `-`). | `app/borrowers/[id]/page.tsx` |
| **FE-NEW-03** | **Interactive Alerts Dashboard & Status Action** | **P1** | Update `app/alerts/page.tsx`: Render severity badges (`Critical`, `High`), format borrower names and loan details, and add interactive action buttons to mark alert as `Acknowledged` or `Resolved` via `PATCH /api/alerts/[id]`. | `app/alerts/page.tsx` |
| **FE-NEW-04** | **Portfolio Analytics KPI Cards & Chart Polish** | **P1** | Update `app/analytics/page.tsx`: Add 4 top-line metric cards (Total Active Portfolio, Book Default Rate, Critical Alerts Count, Average Risk Score). Polish Recharts charts with tooltips and responsive styling. | `app/analytics/page.tsx` |
| **FE-NEW-05** | **Empty States, Skeleton Loaders & Design Polish** | **P2** | Add loading skeleton states (table row skeletons, card skeletons) for smooth transitions during API fetches; add friendly empty states ("No high risk borrowers found"); verify consistent navy/slate financial theme. | `components/ui/skeleton.tsx`, `app/*` |

---

## 5. Execution Dependency Flow

```mermaid
flowchart TD
    subgraph Step 1: Schema & Data Alignment (Immediate Blockers)
        ML01[ML-NEW-01: Realign Seed Generator Script]
        BE01[BE-NEW-01: Realign Supabase Schema Migration]
        ML01 & BE01 --> ML02[ML-NEW-02: Regenerate Seed CSVs]
        ML02 --> ML03[ML-NEW-03: Ingest Data into Supabase]
    end

    subgraph Step 2: Backend API Upgrades
        ML03 --> BE02[BE-NEW-02: Unified Borrower Detail + Score API]
        ML03 --> BE03[BE-NEW-03: Borrower List Filter API]
        BE01 --> BE04[BE-NEW-04: Alert PATCH Route]
    end

    subgraph Step 3: Frontend Feature Delivery
        BE03 --> FE01[FE-NEW-01: Borrower Table + Filters + Pagination]
        BE02 --> FE02[FE-NEW-02: Borrower Profile + SHAP Recharts]
        BE04 --> FE03[FE-NEW-03: Alerts Status Actions]
        BE02 --> FE04[FE-NEW-04: Portfolio KPI Cards & Charts]
    end

    subgraph Step 4: Final Polish & Delivery
        FE01 & FE02 & FE03 & FE04 --> FE05[FE-NEW-05: Skeletons & Theme Polish]
        FE05 --> BE05[BE-NEW-05: Vercel Production Deployment]
        ML04[ML-NEW-04: Drift Presentation Asset] --> DEMO[Final Team Demo & Rehearsal]
        ML05[ML-NEW-05: Model Card & Talking Points] --> DEMO
        BE05 --> DEMO
    end
```

---

## 6. Detailed Step-by-Step Implementation Guide

### Phase 1: Alignment & Ingestion (Tasks ML-01, BE-01, ML-02, ML-03)
- **Person 1 (ML):** Modify `prepare_seed_data.py` to ensure generated dictionary keys match `external_id`, `full_name`, `loan_type`, `employment_status`, `monthly_income`, `outstanding_balance`, `tenure_months`, `geography`. Generate top-3 reasons with clear descriptive text. Run script to produce `seed_borrowers.csv` and `seed_scores_reasons.csv`.
- **Person 2 (Backend):** Review `0001_init.sql` to confirm table columns match the CSV headers. Execute the migration against Supabase.
- **Person 1 (ML) & Person 2 (Backend):** Execute `scripts/seed_database.py` to upload the 400 borrowers and generate corresponding `alerts` rows for high/critical borrowers.

### Phase 2: API Endpoints & Seams (Tasks BE-02, BE-03, BE-04)
- **Person 2 (Backend):** 
  - Enhance `lib/scoring/getScore.ts` and `app/api/borrowers/[id]/score/route.ts` to return both borrower details and score/reasons.
  - Create `app/api/alerts/[id]/route.ts` to support `PATCH` updating status to `acknowledged` or `resolved`.
  - Validate all endpoints using curl or browser against local Supabase.

### Phase 3: Frontend Pages & Data Visualization (Tasks FE-01, FE-02, FE-03, FE-04)
- **Person 3 (Frontend):**
  - Fix table mappings in `app/borrowers/page.tsx`, wire search and risk filter tabs, add pagination controls.
  - Refactor `app/borrowers/[id]/page.tsx` with borrower profile grid and Recharts horizontal bar chart for SHAP explainability.
  - Add status toggle buttons (`Acknowledge`, `Resolve`) in `app/alerts/page.tsx`.
  - Add summary KPI metric cards to `app/analytics/page.tsx`.

### Phase 4: Production Deployment & Live Demo Prep (Tasks FE-05, BE-05, ML-04, ML-05)
- **Person 3 (Frontend):** Add loading skeletons and empty states to prevent layout shifts.
- **Person 2 (Backend):** Connect git repo to Vercel, inject environment variables, and verify live build.
- **Person 1 (ML):** Complete `ml/drift_report.md` and `ml/model_card.md` highlighting AUC/Precision/Recall metrics.
- **All Members:** Run end-to-end rehearsal walking through: **Login -> Borrower Book -> Borrower Detail & SHAP Reasons -> Alert Resolution -> Portfolio Analytics -> Drift Explanation**.

---

## 7. Completion Acceptance Checklist

### 🧑‍💻 Person 1 (ML Engineer)
- [ ] `seed_borrowers.csv` has valid `external_id`, `full_name`, `loan_type`, and `outstanding_balance`.
- [ ] `seed_scores_reasons.csv` has top-3 SHAP reasons with impact direction and human-readable descriptions.
- [ ] Automated seed script successfully populates Supabase `borrowers`, `risk_scores`, `risk_reasons`, and `alerts`.
- [ ] `ml/drift_report.md` documents performance degradation across sub-populations.
- [ ] `ml/model_card.md` contains complete model evaluation statistics and talking points.

### 🛠️ Person 2 (Backend & Infra)
- [x] Supabase database schema matches application types exactly.
- [x] `GET /api/borrowers` correctly returns paginated borrowers with risk scores.
- [x] `GET /api/borrowers/[id]/score` returns borrower profile + score + SHAP reasons.
- [x] `PATCH /api/alerts/[id]` updates alert status with proper authorization.
- [x] Production build clean & Vercel deployment instructions configured.

### 🎨 Person 3 (Frontend)
- [ ] `/borrowers` page displays full names, IDs, balances, and allows filtering by risk bucket.
- [ ] `/borrowers/[id]` displays borrower details and Recharts horizontal SHAP bar chart (Red/Green).
- [ ] `/alerts` displays open high/critical alerts and allows marking alerts as acknowledged/resolved.
- [ ] `/analytics` displays 4 top-line KPI metrics and distribution charts.
- [ ] All pages display loading states without layout jitter.
