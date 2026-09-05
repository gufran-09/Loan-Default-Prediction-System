# Aegis Risk — Run Guide

This guide details how to set up, configure, and run the **Aegis Risk AI-Powered Loan Default Prediction System**, including the Next.js frontend/backend, Supabase database, and Python Machine Learning pipeline.

---

## 1. Prerequisites

* **Node.js**: v18.0.0 or higher
* **Package Manager**: `npm` or `pnpm`
* **Python**: 3.10+ (for ML workflows and database seeding)
* **Supabase**: Cloud project or local instance

---

## 2. Environment Configuration

1. Create or verify your `.env` (or `.env.local`) in the project root directory.
2. Required keys:
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>

   # Service Role Key (Used for admin operations & data seeding)
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   ```
*(Refer to `.env.example` for the template)*

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
* `/analytics` — Model Performance & Data Drift Monitoring
* `/alerts` — High-Risk Loan Flags & Notifications
* `/signin` — Team Sign In
* `/signup` — Account Registration

### Production Build
```bash
npm run build
npm run start
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
pip install supabase python-dotenv
```

---

## 5. Database Seeding

To populate Supabase tables (`borrowers`, `risk_scores`, `risk_reasons`) with initial data:

```bash
python scripts/seed_database.py
```
> **Note:** Ensure `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are populated in `.env`.

---

## 6. Machine Learning Pipeline

Pre-trained model artifacts are stored in `ml/` (`model.pkl`, `feature_columns.json`, `drift_report.json`). If you want to re-execute any ML steps:

* **Train XGBoost Model:**
  ```bash
  python scripts/train_model.py
  ```
* **Simulate & Evaluate Feature Drift:**
  ```bash
  python scripts/simulate_drift.py
  ```
* **Regenerate Seed Datasets from Raw CSV:**
  ```bash
  python scripts/prepare_seed_data.py
  ```

---

## 7. AWS S3 Model Registry & Artifact Sync

To synchronize trained models, drift reports, and datasets to an Amazon S3 bucket:

```bash
python scripts/aws_s3_sync.py
```
*(Supports dry-run mode without credentials, or live upload when `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_S3_BUCKET_NAME` are configured in `.env`)*

