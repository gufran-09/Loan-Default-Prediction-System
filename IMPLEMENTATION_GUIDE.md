# AI-Powered Loan Default Prediction System — Implementation Guide

**Repo:** `ai-powered-loan-default-prediction-system` (Next.js 16 + Supabase, generated via v0, product name "Aegis Risk")
**Dataset:** `Loan_default_cleaned.csv` — 255,347 rows, 32 columns, 0 missing values, 0 duplicates, target `Default` (11.6% positive rate)

This guide picks up exactly where your two uploads leave off. Part A audits what's already built vs. what's missing. Part B is the step-by-step build order to get from here to a working, demo-ready system.

---

## Part A — Current State Audit

### What the scaffold already has
- Next.js App Router structure: `/app/login`, `/app/borrowers`, `/app/borrowers/[id]`, `/app/alerts`, `/app/analytics`
- API routes: `GET /api/borrowers`, `GET /api/borrowers/:id/score`, `GET /api/alerts`, `GET /api/analytics/portfolio` — all real, querying Supabase (not mocked), all auth-gated
- Supabase auth wiring (`lib/supabase/client.ts`, `server.ts`), working login page
- Shared types in `lib/types/index.ts`: `Borrower`, `RiskScore`, `Alert`
- `docs/api-contract.md` documenting the response shapes
- shadcn/Tailwind UI foundation, dashboard shell component

### What's missing (blocks everything else from working)
1. **No Supabase migrations** — the API routes query tables `borrowers`, `risk_scores`, `risk_reasons`, `alerts` that don't exist yet anywhere in the repo
2. **No seed/data-loading script** — nothing populates those tables
3. **No `.env.example`** — Supabase URL/key requirements aren't documented for teammates
4. **No `/lib/scoring` swap-point** — the report/prompt called for one function that isolates "where the model plugs in"; right now the score route reads `risk_scores` directly with no abstraction layer
5. **No README** — no setup instructions for your 3 teammates
6. **No mapping between your ML dataset's schema and the app's DB schema** — this is the biggest gap, detailed in Step 2 below
7. **No RLS (Row Level Security) policies** — Supabase tables are unprotected by default; needed before this is "production-grade"

### The critical mismatch to resolve first

Your `Loan_default_cleaned.csv` and the app's `Borrower` type don't line up:

| App expects (`lib/types/index.ts`) | In your CSV? | Notes |
|---|---|---|
| `full_name`, `email` | ❌ No | Source data is anonymized — must be synthetically generated for display |
| `external_id` | ❌ No | Generate a stable ID per row |
| `geography` | ❌ No | Not in this dataset at all — must be synthetically assigned |
| `loan_type` | ⚠️ Partial | Map from `LoanPurpose_*` one-hot columns (Auto/Business/Education/Home/Other) |
| `loan_amount` | ✅ `LoanAmount` | Direct |
| `outstanding_balance` | ❌ No | Not in dataset — derive (e.g. a fraction of `LoanAmount`) or set equal to `LoanAmount` for non-defaulted loans |
| `tenure_months` | ⚠️ Ambiguous | `LoanTerm` is the loan's term length, not elapsed tenure — decide which one the dashboard actually means and document it |
| `monthly_income` | ⚠️ Derive | `Income` in this dataset is annual — divide by 12 |
| `employment_status` | ⚠️ Partial | Map from `EmploymentType_*` one-hot columns |

You'll need a small transformation script (Step 2) before this data can seed Supabase. This is normal — ML datasets are built for modeling, not for populating a UI, so an adapter layer between them is expected, not a sign something went wrong.

---

## Part B — Step-by-Step Build Order

### Step 1 — ML: Train the model

1.1. Split the data — since `Default` is 11.6% positive, use **stratified** train/test split (e.g. 80/20) so both sets keep the same class ratio.

1.2. Train two models for comparison:
   - Logistic Regression (baseline, interpretable)
   - XGBoost (your primary model)

1.3. Handle class imbalance — use `scale_pos_weight` in XGBoost (ratio of negative:positive, ≈7.6) rather than oversampling first; it's simpler and works well for tree models. Try SMOTE only if `scale_pos_weight` alone underperforms.

1.4. Evaluate with AUC-ROC, precision-recall (not just accuracy — with an 88/12 split, a model predicting "no default" for everyone would already look 88% accurate and be useless). Also check the confusion matrix at your chosen threshold.

1.5. Generate SHAP values on the test set — both global feature importance (for your presentation) and per-row explanations (for the "reason for score" feature).

1.6. Save two artifacts: the trained model (`model.json` or `.pkl`) and a `feature_columns.json` listing the exact column order the model expects — you'll need this order preserved when scoring new rows later.

**Output of this step:** a trained model + SHAP explainer you can run against any row in the dataset.

---

### Step 2 — Build the data adapter (ML dataset → App DB schema)

Write a Python script (`scripts/prepare_seed_data.py`) that:

1. Loads `Loan_default_cleaned.csv`
2. Reverses the one-hot encoding back to single categorical columns where useful (e.g. combine `LoanPurpose_*` columns back into one `loan_type` string column)
3. Generates the missing identity fields for a **sample** of rows (don't seed all 255,347 — pick ~200-500 for a working demo dataset):
   - `external_id`: e.g. `LN-000001` incrementing
   - `full_name`, `email`: use the Python `faker` library — do not hand-write these
   - `geography`: assign randomly from a fixed list of cities/regions relevant to your story (e.g. a handful of Indian cities, since your project's framing is India-based lending)
4. Derives the ambiguous fields:
   - `monthly_income = Income / 12`
   - `outstanding_balance`: for `Default == 0` rows, set to a random 40-90% of `LoanAmount` (simulates partial repayment); for `Default == 1` rows, set closer to full `LoanAmount`
   - `tenure_months`: use `LoanTerm` directly, document this choice in the README
5. Runs the trained model + SHAP from Step 1 on this sample to produce real `score`, `bucket`, and top-3 `reasons` per row — **do not fabricate these**, since this is the one part of the seed data that should reflect your actual model
6. Writes two CSVs ready for Supabase import: `seed_borrowers.csv` and `seed_scores_reasons.csv`

**Why sample instead of loading all 255K rows:** a demo dashboard with 200-500 borrowers is easier to browse, faster to query, and just as convincing as one with 255,347 — you can always load more later once the core system works.

---

### Step 3 — Supabase: schema, migrations, seed

3.1. Create `supabase/migrations/0001_init.sql` defining four tables that match `lib/types/index.ts` exactly:

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

3.2. Add **RLS policies** — enable RLS on all four tables, add a policy allowing `select` for any `authenticated` user (tighten further later if you add row-level ownership):

```sql
alter table borrowers enable row level security;
create policy "authenticated read" on borrowers for select to authenticated using (true);
-- repeat for risk_scores, risk_reasons, alerts
```

3.3. Run the migration against your Supabase project (`supabase db push` or paste into the Supabase SQL editor).

3.4. Load `seed_borrowers.csv` and `seed_scores_reasons.csv` from Step 2 via the Supabase table editor's CSV import, or a small Python/Node loader script using the `supabase-py` / `supabase-js` client.

3.5. Auto-generate alerts for any seeded borrower whose bucket is `high` or `critical` — a simple SQL insert or a small script, not a real EventBridge/SNS pipeline yet (that's the AWS phase from the earlier report).

**Checkpoint:** with this done, `GET /api/borrowers` and the `/borrowers` page should already work against real data with zero frontend code changes, since the API routes were written to expect exactly this schema.

---

### Step 4 — Backend: fill the remaining gaps

4.1. Add `.env.example` to the repo root:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

4.2. Build the `/lib/scoring` swap-point that the original plan called for — right now `app/api/borrowers/[id]/score/route.ts` queries `risk_scores` directly. Wrap that query in a single function:

```ts
// lib/scoring/getScore.ts
export async function getScoreForBorrower(supabase, borrowerId: string) {
  // current: reads from risk_scores table (seeded from your offline model run)
  // later: this is the ONE function that changes to call a live model endpoint
  ...
}
```
Have the route call this function instead of querying inline. This is a small refactor but it's the seam your ML teammate needs when the model eventually moves from "batch-scored into Supabase" to "scored live via an endpoint."

4.3. Verify the `/api/alerts` and `/api/analytics/portfolio` routes return sensible data once seeded — these were written against the schema already, so this is mostly verification, not new code.

---

### Step 5 — Frontend: verify and finish remaining pages

5.1. `/app/borrowers/[id]/page.tsx` — confirm it renders the SHAP-style `reasons` array as a bar chart (Recharts is already a dependency). This is your most important UI screen for the "explainability" story.

5.2. `/app/alerts/page.tsx` and `/app/analytics/page.tsx` — check these exist and render against the now-real API responses (open the files and confirm — they weren't inspected in the same depth as the borrowers/login pages during this audit).

5.3. Add empty/loading/error states everywhere — the routes already return structured errors (`{ error: { code, message } }`), make sure the UI actually surfaces them instead of silently failing.

---

### Step 6 — Team split from here

With a 3-person team, Infra folds into Backend for now (real AWS work is a later phase per the earlier project report — there's nothing AWS-specific to do yet at this local/Supabase stage):

| Owner | Picks up from here |
|---|---|
| **ML** | Step 1 (training + SHAP), then re-runs Step 2's scoring portion whenever the model improves |
| **Backend + Infra** | Step 3 (migrations, RLS, seeding), Step 4 (`.env.example`, `/lib/scoring` refactor), and README/setup instructions for the team |
| **Frontend** | Step 5 (verify/finish remaining pages against real data) |

Lock Step 3's table schema **before** Step 5 frontend work continues — it's the shared contract every other piece depends on, same as `/lib/types` was flagged as review-required in the original scaffold prompt.

When you eventually move to the AWS phase (SageMaker, Kinesis, etc. from the earlier project report), Backend+Infra is the natural person to split into its own role if a 4th teammate joins later, or the group can rotate that work across all three once the Supabase version is stable.

---

## Immediate next action

Start with **Step 1 (train the model)** and **Step 3.1-3.2 (migrations + RLS)** in parallel — they don't depend on each other. Step 2 (the data adapter) is the joining point and needs both to be ready before it can run end-to-end.
