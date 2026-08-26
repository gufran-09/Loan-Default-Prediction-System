# Aegis Risk — Full Implementation Guide

**Project:** AI-Powered Loan Default Prediction System (PS-01)
**Team:** 3 members — ML, Backend+Infra, Frontend
**Repo base:** Next.js 16 (App Router) + Supabase, scaffolded via v0
**Dataset:** `Loan_default_cleaned.csv` — 255,347 rows, 32 columns, 0 missing values, 0 duplicates, target `Default` (11.6% positive rate)

This is the complete build guide, feature by feature, from an empty backend to a working demo. Each feature has: what it is, who owns it, what it depends on, the exact steps, and how to know it's done. Follow features in order — each one unblocks the next.

Save this file at `/docs/IMPLEMENTATION_GUIDE.md` in the repo so the whole team works from the same copy.

---

## How to read this document

- **Owner** — who drives it (ML / Backend+Infra / Frontend). Anyone can read any section; only the owner should merge changes to it.
- **Depends on** — must be done first.
- **Done when** — the acceptance check. Don't move on until this is true.

---

## Feature 0 — Foundation (schema, environment, project setup)

**Owner:** Backend+Infra
**Depends on:** Nothing — do this first
**Done when:** Any teammate can clone the repo, add their own `.env.local`, run `npm install && npm run dev`, and see the login page load without errors.

### Steps

1. Create `.env.example` at the repo root:
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
   ```
2. Create a shared Supabase project (one project, one set of credentials for the whole team — don't let each person spin up their own). Share the URL + anon key with the team via a private channel, not committed to git.
3. Write `supabase/migrations/0001_init.sql`:
   ```sql
   create table borrowers (
     id uuid primary key default gen_random_uuid(),
     external_id text unique not null,
     full_name text not null,
     email text not null,
     loan_type text not null,
     loan_amount numeric not null,
     outstanding_balance numeric not null,
     geography text not null,
     tenure_months int not null,
     monthly_income numeric not null,
     employment_status text not null,
     created_at timestamptz default now()
   );

   create table risk_scores (
     id uuid primary key default gen_random_uuid(),
     borrower_id uuid references borrowers(id) on delete cascade,
     score numeric not null,
     bucket text not null check (bucket in ('low','medium','high','critical')),
     model_version text not null,
     scored_at timestamptz default now()
   );

   create table risk_reasons (
     id uuid primary key default gen_random_uuid(),
     risk_score_id uuid references risk_scores(id) on delete cascade,
     reason text not null,
     feature text not null,
     impact numeric not null,
     rank int not null
   );

   create table alerts (
     id uuid primary key default gen_random_uuid(),
     borrower_id uuid references borrowers(id) on delete cascade,
     title text not null,
     description text,
     severity text check (severity in ('high','medium','low')),
     status text check (status in ('open','acknowledged','resolved')) default 'open',
     created_at timestamptz default now()
   );
   ```
4. Enable RLS and add read policies for authenticated users:
   ```sql
   alter table borrowers enable row level security;
   alter table risk_scores enable row level security;
   alter table risk_reasons enable row level security;
   alter table alerts enable row level security;

   create policy "authenticated read" on borrowers for select to authenticated using (true);
   create policy "authenticated read" on risk_scores for select to authenticated using (true);
   create policy "authenticated read" on risk_reasons for select to authenticated using (true);
   create policy "authenticated read" on alerts for select to authenticated using (true);
   ```
5. Run the migration (`supabase db push`, or paste directly into the Supabase SQL editor).
6. Write the root `README.md` with: setup steps above, the ownership table from this guide, and the branch naming convention (`feature/ml-*`, `feature/backend-*`, `feature/frontend-*`).

---

## Feature 1 — Authentication

**Owner:** Backend+Infra (frontend already has the login page from the scaffold — this feature is about making it real, not building UI)
**Depends on:** Feature 0
**Done when:** A teammate can sign up a test "risk officer" account, log in, get redirected to the dashboard, and get redirected back to `/login` if they try to visit a protected page while logged out.

### Steps

1. In Supabase Auth settings, enable email/password sign-in (disable email confirmation for now during development — turn it back on before any real deployment).
2. Create one shared test account (e.g. `demo@aegisrisk.test`) so the whole team can log in with the same credentials during development, rather than each person creating separate accounts.
3. Verify `lib/supabase/client.ts` and `lib/supabase/server.ts` point at your team's project (via the `.env.local` values, not hardcoded).
4. Confirm route protection: any request to `/borrowers`, `/alerts`, `/analytics` without a valid session redirects to `/login`. Check this in `middleware.ts` if present, or in each page's server component.
5. Confirm the API routes (`/api/borrowers`, etc.) also reject unauthenticated requests — not just the pages. An API route without its own auth check is a real security gap even if the page in front of it is protected.

---

## Feature 2 — ML: Model Training and Explainability

**Owner:** ML
**Depends on:** Nothing (can start immediately, in parallel with Features 0-1) — but its *output* feeds Feature 3
**Done when:** You have a saved model file, a saved feature-column order file, and can produce a risk score + top-3 SHAP reasons for any single row of the dataset on demand.

### Steps

1. **Load and split.** Load `Loan_default_cleaned.csv`. Do a stratified 80/20 train/test split (stratified because `Default` is 11.6% positive — a plain random split risks an uneven ratio between train and test).
2. **Baseline model.** Train a Logistic Regression on the training set. This is your comparison point, not your final model — but it's expected practice in credit risk work and strengthens your evaluation section.
3. **Primary model.** Train XGBoost. Use `scale_pos_weight` ≈ 7.6 (ratio of negatives to positives) to address the class imbalance rather than reaching for SMOTE first — simpler, and works well for tree-based models.
4. **Evaluate properly.** Report AUC-ROC and precision-recall for both models, plus a confusion matrix at a chosen threshold. Do not report plain accuracy as your headline number — with an 88/12 split, a model that always predicts "no default" already looks 88% accurate while being useless.
5. **Explainability.** Run SHAP on the XGBoost model against the test set. Produce:
   - A global feature-importance plot (for your presentation/report)
   - A function that, given one row, returns its top-3 contributing features with direction (increases or decreases risk) — this is what feeds the "reason for score" UI in Feature 4
6. **Drift demonstration (optional but strong for your presentation).** Since this is a static dataset, simulate drift: train on one slice, test on a different slice, and show the accuracy gap. Frame this as "how this model would degrade without retraining" when you present.
7. **Save artifacts** to a shared location the team can access (e.g. a `/ml` folder in the repo, or cloud storage):
   - `model.json` (or `.pkl`) — the trained XGBoost model
   - `feature_columns.json` — the exact column order/names the model expects as input, in order. This file matters more than it looks — if the seed script or any future live-scoring code passes columns in a different order, predictions silently break.
   - A short `model_card.md` — what the model is, what data it was trained on, its AUC/precision-recall numbers, and known limitations (e.g. "trained on a public dataset, not this project's real institutional data").

---

## Feature 3 — Data Bridge: Seed Data Generation

**Owner:** ML leads this (owns the scoring logic), Backend+Infra reviews (owns the schema it writes into)
**Depends on:** Feature 0 (schema must exist) and Feature 2 (model must exist)
**Done when:** Two CSVs exist — `seed_borrowers.csv` and `seed_scores_reasons.csv` — ready to load into Supabase, with real model-generated scores (not fabricated numbers).

### Why this feature exists

Your ML dataset and the app's database schema don't line up — the CSV has no borrower name, email, or geography, and some fields need reshaping. This bridge script is the one place that translation happens, so it only needs to be built once.

| App needs | Source in CSV | How to get it |
|---|---|---|
| `external_id` | — | Generate: `LN-000001`, incrementing |
| `full_name`, `email` | — | Generate with the `faker` Python library — don't hand-write these |
| `geography` | — | Randomly assign from a fixed list of cities relevant to your story |
| `loan_type` | `LoanPurpose_*` one-hot columns | Reverse the one-hot encoding back into a single string column |
| `loan_amount` | `LoanAmount` | Direct copy |
| `outstanding_balance` | — | For `Default == 0`: random 40-90% of `LoanAmount`. For `Default == 1`: close to full `LoanAmount` |
| `tenure_months` | `LoanTerm` | Direct copy — document that this is the loan's term, not elapsed time |
| `monthly_income` | `Income` (annual) | `Income / 12` |
| `employment_status` | `EmploymentType_*` one-hot columns | Reverse the one-hot encoding |
| `score`, `bucket`, `reasons` | — | Run the Feature 2 model + SHAP on this row — real output, not fabricated |

### Steps

1. Write `scripts/prepare_seed_data.py`.
2. Load the CSV, and take a random sample of ~300-500 rows (not all 255,347 — a demo dashboard is easier to browse and just as convincing at this size, and you can always load more later).
3. Reverse the one-hot columns back into single categorical fields.
4. Generate the missing identity fields (`faker` library, fixed geography list).
5. Derive `monthly_income` and `outstanding_balance` as described above.
6. Load `model.json` and `feature_columns.json` from Feature 2. For each sampled row: reorder its columns to match `feature_columns.json` exactly, run the model to get `score`, convert score to a `bucket` (e.g. low < 0.3, medium < 0.6, high < 0.85, critical ≥ 0.85 — agree on these cutoffs with ML), and run SHAP to get the top-3 `reasons`.
7. Write two output files matching the Feature 0 schema exactly:
   - `seed_borrowers.csv` — one row per borrower
   - `seed_scores_reasons.csv` — one score row + up to 3 reason rows per borrower
8. Hand off to Backend+Infra for loading (Feature 0's tables must already exist).

---

## Feature 4 — Backend: Data Loading and Scoring Seam

**Owner:** Backend+Infra
**Depends on:** Feature 3
**Done when:** `GET /api/borrowers` returns real seeded data, and there is exactly one function in the codebase that will need to change when live model scoring replaces batch-seeded scoring.

### Steps

1. Load `seed_borrowers.csv` and `seed_scores_reasons.csv` into Supabase — via the table editor's CSV import, or a small loader script using the `supabase-js`/`supabase-py` client. Load borrowers first (scores reference `borrower_id`).
2. Auto-generate `alerts` rows for every seeded borrower whose bucket is `high` or `critical` — a simple SQL insert or small script. (This is a placeholder for the real-time alert pipeline described in the project's original AWS architecture — not a live system yet.)
3. Create the scoring seam at `lib/scoring/getScore.ts`:
   ```ts
   // Currently: reads a pre-computed score from risk_scores (written by
   // the Feature 3 seed script). Later: this is the ONE function that
   // changes to call a live model endpoint instead.
   export async function getScoreForBorrower(supabase, borrowerId: string) {
     // existing risk_scores + risk_reasons query goes here
   }
   ```
4. Update `app/api/borrowers/[id]/score/route.ts` to call this function instead of querying inline.
5. Verify all four API routes (`/api/borrowers`, `/api/borrowers/:id/score`, `/api/alerts`, `/api/analytics/portfolio`) return correctly shaped data against the real seeded tables, matching `docs/api-contract.md` and `lib/types/index.ts` exactly.

---

## Feature 5 — Frontend: Borrower List Dashboard

**Owner:** Frontend
**Depends on:** Feature 4 (needs real data to render against; can be UI-built earlier against the scaffold's existing types if blocked)
**Done when:** A logged-in risk officer sees a searchable, filterable list of real borrowers with their risk bucket, and can click through to any borrower's detail page.

### Steps

1. Confirm `/app/borrowers/page.tsx` fetches from `GET /api/borrowers` (already wired in the scaffold — this step is verification against real data, not new code).
2. Add/verify filter by risk bucket (Low/Medium/High/Critical) and a text search over borrower name.
3. Add pagination if the seeded set is large enough to need it.
4. Add loading and empty states (e.g. "No borrowers match this filter").
5. Confirm each row links to `/borrowers/[id]`.

---

## Feature 6 — Frontend: Borrower Detail + Explainability View

**Owner:** Frontend
**Depends on:** Feature 4
**Done when:** Opening a borrower shows their score, risk bucket, full details, and a bar chart of their top-3 SHAP reasons with clear direction (increases/decreases risk).

### Steps

1. Confirm `/app/borrowers/[id]/page.tsx` calls `GET /api/borrowers/:id/score`.
2. Render `reasons` as a horizontal bar chart using Recharts (already a project dependency) — bar length = magnitude of impact, color or icon indicating direction.
3. Display the borrower's core details (loan type, amount, outstanding balance, tenure, income, employment status, geography) alongside the score.
4. Handle the case where a borrower has no score yet (shouldn't happen post-seeding, but handle it defensively) and the case where the API returns an error.

---

## Feature 7 — Frontend: Alerts Panel

**Owner:** Frontend
**Depends on:** Feature 4
**Done when:** The alerts page lists all open high/critical-risk borrowers, most recent first, and clicking one goes to their detail page.

### Steps

1. Confirm/build `/app/alerts/page.tsx` calling `GET /api/alerts`.
2. Show severity (high/medium/low) visually distinct — this is a risk officer's "what needs attention right now" view, so visual priority matters more than on other pages.
3. Support marking an alert as acknowledged/resolved if time allows (updates `alerts.status` — this needs a new `PATCH` route, decide with Backend+Infra whether it's in scope for this phase).
4. Link each alert to the relevant borrower's detail page.

---

## Feature 8 — Frontend: Portfolio Analytics

**Owner:** Frontend
**Depends on:** Feature 4
**Done when:** The analytics page shows real aggregate charts — risk distribution by loan type, geography, and tenure — computed from the seeded data.

### Steps

1. Confirm/build `/app/analytics/page.tsx` calling `GET /api/analytics/portfolio`.
2. Confirm the API route performs real aggregation queries against Supabase (grouping by loan type / geography / tenure bucket), not hardcoded numbers.
3. Render with Recharts — bar or pie charts depending on what reads clearest for each breakdown.
4. Add a top-line summary (e.g. total borrowers, overall default rate in the seeded set, count of high/critical borrowers) above the charts.

---

## Feature 9 — Polish and Demo Readiness

**Owner:** All three, split by area
**Depends on:** Features 1-8 complete
**Done when:** The app can be walked through start-to-finish in a live demo without errors, and a new teammate could set it up from the README alone.

### Steps

1. Error handling pass — confirm every page has a sensible loading state, empty state, and error state (the API already returns structured `{ error: { code, message } }` responses; make sure the UI surfaces them instead of failing silently).
2. Visual pass — consistent navy/blue professional styling across all pages (per the original design brief), no leftover placeholder text or Lorem Ipsum.
3. README pass — confirm setup instructions actually work by having a teammate follow them on a clean clone.
4. Deployment — deploy the frontend (Vercel is the natural fit for Next.js) pointed at the shared Supabase project, so the demo has a real URL instead of only running locally.
5. Prepare the "what's real vs. simulated" talking points for stakeholders: the model is real and trained by your team; the scoring is currently batch-seeded rather than live; the AWS-native production architecture (SageMaker, Kinesis, etc.) is documented separately as the next phase, not built yet.

---

## Feature 10 — Next Phase: AWS Migration (not in this build cycle)

**Owner:** Whoever picks up Infra once the Supabase version is stable — can be rotated across the team
**Depends on:** Feature 9 complete and demoed
**Done when:** Out of scope for now — tracked here as the known next step, not a task to start yet.

This is the AWS-native architecture from the earlier project report (S3, SageMaker Serverless Inference, SageMaker Clarify, Kinesis, Lambda, DynamoDB/RDS, Amplify, Cognito). Revisit that report when this phase actually starts — don't begin it before the Supabase version above is working end to end, since building AWS infrastructure before the product logic is proven adds cost and complexity with no payoff yet.

---

## Full dependency chain (quick reference)

```
Feature 0 (Foundation)
   ├─→ Feature 1 (Auth)
   └─→ Feature 3 (Data Bridge) ←── Feature 2 (ML model, parallel from day 1)
           └─→ Feature 4 (Backend seed + scoring seam)
                   ├─→ Feature 5 (Borrower list)
                   ├─→ Feature 6 (Borrower detail + SHAP)
                   ├─→ Feature 7 (Alerts)
                   └─→ Feature 8 (Analytics)
                           └─→ Feature 9 (Polish + demo)
                                   └─→ Feature 10 (AWS migration — later)
```

**Start today, in parallel:** Feature 0 (Backend+Infra) and Feature 2 (ML). Frontend can begin UI work on Features 5-8 against the scaffold's existing mock/type shapes while waiting, then swap to real data once Feature 4 lands.
