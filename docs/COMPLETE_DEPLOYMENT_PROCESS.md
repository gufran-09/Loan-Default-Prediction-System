# Loan Sentry — Complete End-to-End Deployment Process

**Live Production URL:** [https://www.loansentry.in](https://www.loansentry.in) (Apex `http://loansentry.in` ➔ HTTP 301 Redirect)  
**AWS Account ID:** `022671037337`  
**Primary Compute Region:** `ap-southeast-2` (Sydney) | **Edge Certificate Region:** `us-east-1` (N. Virginia)  
**Document Location:** `docs/COMPLETE_DEPLOYMENT_PROCESS.md`  
**Related Guides:** [`PRODUCTION_DEPLOYMENT_GUIDE.md`](file:///D:/PROJECTS/MASS_MUTUAL/Loan-Default-Prediction-System/PRODUCTION_DEPLOYMENT_GUIDE.md) • [`docs/aws-concepts/00_OVERVIEW.md`](file:///D:/PROJECTS/MASS_MUTUAL/Loan-Default-Prediction-System/docs/aws-concepts/00_OVERVIEW.md) • [`scripts/deploy_production.py`](file:///D:/PROJECTS/MASS_MUTUAL/Loan-Default-Prediction-System/scripts/deploy_production.py)

---

## 1. Executive Overview

The **Loan Sentry** (Aegis Risk) deployment architecture is a **Multi-Region, Hybrid Serverless & Containerized Cloud Pipeline** built on AWS Free-Tier / low-cost primitives. It separates global edge security and TLS termination (`us-east-1` + CloudFront Anycast PoPs) from the Next.js 16 application runtime, relational database, and ML inference engines (`ap-southeast-2`).

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              END-TO-END DEPLOYMENT & RUNTIME ARCHITECTURE                                │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  [Developer / CLI] ──(1. source.zip)──> [Amazon S3: aegis-risk-storage-022671037337/build/source.zip]
                                                       │
                                                       ▼ (2. Trigger Build)
                                         [AWS CodeBuild: aegis-risk-build]
                                          • Runs buildspec.yml + Dockerfile
                                          • Compiles Next.js 16 Standalone
                                                       │
                                                       ▼ (3. docker push :latest)
                                         [Amazon ECR: aegis-risk]
                                                       │
                                                       ▼ (4. force-new-deployment)
  [Users] ──> [GoDaddy DNS] ──> [CloudFront CDN: E2WK4WS85BY6CX] ──> [ALB: Port 80] ──> [ECS Fargate]
               (www CNAME &      • ACM Wildcard TLS 1.3 (us-east-1)    (Target Group     (Next.js 16
                301 Apex)        • AWS WAF Rate Limiting               /api/health)      Port 3000)
                                 • Cache Invalidation (/*)                                  │
                                                                                            ▼
                                                         ┌──────────────────────────────────┴──────────────────────────────────┐
                                                         │                      Downstream AWS & External Services             │
                                                         │ • Amazon RDS PostgreSQL 16 (aegis-risk-db)                          │
                                                         │ • AWS Cognito User Pool (ap-southeast-2_80G23Am1X)                  │
                                                         │ • API Gateway v2 ➔ AWS Lambda (aegis-risk-scoring-engine)           │
                                                         │ • AWS Step Functions (Aegis-Risk-Credit-Decisioning)                │
                                                         │ • Amazon Bedrock (Claude 3.5 Haiku) & Amazon Textract (OCR)         │
                                                         │ • CloudWatch Logs (/aegis-risk/audit-trail) & Amazon SNS            │
                                                         │ • Meta WhatsApp Business Cloud API v21.0                            │
                                                         └─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase 1 — Data, Auth & Model Artifact Foundation

Before deploying the web application, the foundational data, identity, and ML artifact layers were provisioned in `ap-southeast-2`.

### 2.1 Amazon RDS PostgreSQL 16 (`aegis-risk-db`)
* **Host:** `aegis-risk-db.c1wu2mekybkk.ap-southeast-2.rds.amazonaws.com:5432`
* **Schema & Seeding:**
  * Relational tables for `borrowers`, `risk_scores`, `risk_alerts`, `shap_reasons`, `alternative_credit_data`, and `scoring_history` were migrated using SQL scripts in `scripts/migrations/` (including `0008_remove_health_disability.sql` for ECOA/FCRA compliance).
  * Seeded with institutional borrower records, calibrated risk scores, alerts, and SHAP explanations (`scripts/seed_rds.py` / `scripts/fast_enrich_rds.mjs`).
  * Configured with SSL connection pooling (`lib/db/postgres.ts`) and Supabase dual-fallback support.

### 2.2 Amazon S3 Model & Build Registry (`aegis-risk-storage-022671037337`)
* Acts as both the **MLOps artifact store** (synchronized via `scripts/aws_s3_sync.py`) and the **build staging bucket** (`s3://aegis-risk-storage-022671037337/build/source.zip`).
* Stores `ml/model.pkl`, `ml/model.json`, `ml/calibrator.pkl`, `ml/feature_columns.json`, and `ml/model_card.md`.

### 2.3 AWS Cognito Identity & Access (`ap-southeast-2_80G23Am1X`)
* Provisioned a **Cognito User Pool** (`ap-southeast-2_80G23Am1X`, App Client `74120ugqosjjpmup4utltl1oqf`) for underwriting officer sign-in/sign-up.
* Application APIs and middleware verify RS256 JSON Web Tokens (JWTs) via `lib/auth/cognitoJwt.ts`.

---

## 3. Phase 2 — Serverless Scoring & Workflow Orchestration

### 3.1 AWS Lambda + Amazon API Gateway v2 (ML Inference Seam)
* **Lambda Function:** `aegis-risk-scoring-engine`
* **API Endpoint:** `https://a3q6b9scn0.execute-api.ap-southeast-2.amazonaws.com/`
* **Purpose:** Executes real-time calibrated XGBoost inference and TreeSHAP attribution extraction decoupled from the Next.js UI container (`lib/scoring/getScore.ts`), with a local/DB cache fallback seam.

### 3.2 AWS Step Functions (`Aegis-Risk-Credit-Decisioning`)
* Deployed an automated **Straight-Through Processing (STP)** state machine (`step-functions-decisioning.json`) that orchestrates:
  1. `ScoreBorrowerRisk` (remote Lambda invocation)
  2. `EvaluateRiskTier` (probability bounds evaluation)
  3. `Disposition Routing` (Auto-Approval, Manual Underwriting Committee Referral, or Adverse Action pathway).

### 3.3 Telemetry, GenAI & OCR Integrations
* **Amazon CloudWatch:** Immutable audit trail logged to `/aegis-risk/audit-trail` and monitored via `Aegis-Risk-Model-Health`.
* **Amazon SNS:** Critical alert notifications pushed to `arn:aws:sns:ap-southeast-2:022671037337:aegis-risk-critical-alerts`.
* **Amazon Bedrock:** On-demand Credit Underwriting Memorandum generation using **Claude 3.5 Haiku**.
* **Amazon Textract:** Automated payslip / W-2 / 1099 OCR parsing for income reconciliation.

---

## 4. Phase 3 — Containerization & Cloud CI/CD (Docker, CodeBuild, ECR)

Rather than building Docker images on a local Windows workstation (which risks NTFS `EPERM` directory-locking errors, WSL2 overhead, and slow residential uploads), builds are compiled cleanly in a managed Linux container on **AWS CodeBuild**.

### 4.1 Multi-Stage Production `Dockerfile`
[`Dockerfile`](file:///D:/PROJECTS/MASS_MUTUAL/Loan-Default-Prediction-System/Dockerfile) uses `node:20-alpine` across three stages:
1. **`deps` Stage:** Copies `package.json` and `package-lock.json` and runs `npm ci` for deterministic dependencies.
2. **`builder` Stage:**
   * Copies source code (respecting `.dockerignore`, which excludes `.git`, `.next`, `node_modules`, `.venv`, `.env*`, and raw bulk CSVs).
   * Sets `BUILD_STANDALONE=true`, `NODE_ENV=production`, `NEXT_TELEMETRY_DISABLED=1`, and Cognito public environment variables.
   * Executes `npm run build` (`next build --webpack`). Because [`next.config.mjs`](file:///D:/PROJECTS/MASS_MUTUAL/Loan-Default-Prediction-System/next.config.mjs) checks `process.env.BUILD_STANDALONE === 'true'`, Next.js emits a minimal self-contained `.next/standalone` bundle.
3. **`runner` Stage:**
   * Creates a non-root user (`nextjs:nodejs`, UID/GID `1001`).
   * Copies only `public/`, `.next/standalone/`, `.next/static/`, and `ml/` (models and feature schemas).
   * Exposes port `3000` and launches `CMD ["node", "server.js"]`.

### 4.2 AWS CodeBuild (`aegis-risk-build`) & Amazon ECR (`aegis-risk`)
* **ECR Repository:** `022671037337.dkr.ecr.ap-southeast-2.amazonaws.com/aegis-risk` (AES-256 encrypted, mutable `latest` tag).
* **CodeBuild Project:** `aegis-risk-build` (`aws/codebuild/amazonlinux2-x86_64-standard:5.0`, `BUILD_GENERAL1_MEDIUM`, privileged mode enabled for Docker-in-Docker).
* **Build Specification ([`buildspec.yml`](file:///D:/PROJECTS/MASS_MUTUAL/Loan-Default-Prediction-System/buildspec.yml)):**
  * `pre_build`: Authenticates Docker to Amazon ECR via `aws ecr get-login-password`.
  * `build`: Runs `docker build -t $REPOSITORY_URI:latest .`.
  * `post_build`: Runs `docker push $REPOSITORY_URI:latest` and emits `imagedefinitions.json`.
* **GitHub Actions CI (`.github/workflows/production-deploy.yml`):** Runs automated code quality checks (`npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm test`) on pushes/PRs to `main`.

---

## 5. Phase 4 — Compute Rollout (ECS Fargate & ALB)

### 5.1 Application Load Balancer (`aegis-risk-alb`)
* **DNS:** `aegis-risk-alb-362464102.ap-southeast-2.elb.amazonaws.com`
* **Listener:** HTTP Port `80` forwarding to Target Group `aegis-risk-tg`.
* **Health Check:** Probes `/api/health` (`app/api/health/route.ts`) to verify container liveness, database connectivity, and ML artifact availability before routing traffic.

### 5.2 Amazon ECS Fargate (`aegis-risk-cluster` / `aegis-risk-service`)
* **Cluster:** `aegis-risk-cluster` (`ap-southeast-2`)
* **Service:** `aegis-risk-service` (`desiredCount: 1`, `FARGATE`, platform `1.4.0`)
* **Task Definition:** `aegis-risk-task:1` (512 MB memory, Port `3000`).
* **Zero-Downtime Rolling Deployment:** When `--force-new-deployment` is triggered, ECS boots a new Fargate task pulling the fresh `:latest` ECR image, waits for it to pass the ALB `/api/health` target check, shifts traffic over, and gracefully drains the old task.

---

## 6. Phase 5 — Edge Security, SSL/TLS & Custom Domain (`loansentry.in`)

### 6.1 Domain Registration & NIXI KYC Clearance
* Acquired `loansentry.in` on **GoDaddy**.
* Completed mandatory **NIXI (National Internet eXchange of India)** digital KYC verification to move the `.in` domain from `IDLE` to `ACTIVE`, unlocking DNS zone management.

### 6.2 Public SSL/TLS Certificate (`us-east-1`)
* Requested a public wildcard certificate in **AWS Certificate Manager (ACM)** in **`us-east-1`** (mandatory region for CloudFront control plane replication):
  * Domains covered: `loansentry.in` and `*.loansentry.in`
  * Certificate ARN: `arn:aws:acm:us-east-1:022671037337:certificate/da5d1012-f60d-4c37-a29e-4759e7e7066e`
  * Validation: Single DNS-01 `CNAME` record (`_a19725f351f0bae814baca18107262df`) added in GoDaddy DNS (avoiding duplicate-name collision by using one CNAME for both apex and wildcard).

### 6.3 AWS CloudFront CDN & WAF (`E2WK4WS85BY6CX`)
* **Distribution Domain:** `d2eh1h9cfhciag.cloudfront.net` (Flat-Rate Free Plan — \$0/mo).
* **Alternate Domain Names (CNAMEs):** `www.loansentry.in`, `loansentry.in`.
* **SSL Security Policy:** `TLSv1.2_2021` attached to the `us-east-1` ACM certificate.
* **AWS WAF:** Integrated Layer-7 rate limiting (`2,000 req / 5 min`) and IP reputation threat shield.
* **Origin Protocol Alignment:** Configured CloudFront origin protocol to **`HTTP only` on Port 80** pointing to `aegis-risk-alb-362464102.ap-southeast-2.elb.amazonaws.com` (resolving an initial `504 Gateway Time-out` caused when CloudFront attempted HTTPS port 443 against an HTTP-80-only ALB).

### 6.4 GoDaddy DNS & RFC 1034 Apex Redirection
* **`www` Subdomain:** `CNAME` record mapping `www` ➔ `d2eh1h9cfhciag.cloudfront.net`.
* **Apex (`@`) Forwarding:** Because DNS RFC 1034 forbids a `CNAME` at the zone apex alongside `SOA`/`NS` records, configured GoDaddy permanent **`HTTP 301` forwarding** from `http://loansentry.in` ➔ `https://www.loansentry.in`.

---

## 7. Phase 6 — Meta WhatsApp Business Cloud API Setup

* Configured a Meta Business App (`Aegis Risk`) with System User `Antigravity MCP` and WABA `2350081079116052` (Phone ID `1349662911564332`).
* Registered the approved transactional template `credit_decision_alert` (`en`, 5 positional parameters).
* Integrated directly against `https://graph.facebook.com/v21.0/{WHATSAPP_PHONE_NUMBER_ID}/messages` in `lib/aws/whatsapp.ts` wrapped in an **Opossum Circuit Breaker** (`lib/resilience/circuitBreaker.ts`).

---

## 8. Phase 7 — Automated CLI Re-Deployment Workflow

To push new code changes from the workspace to `https://www.loansentry.in`, the project uses [`scripts/deploy_production.py`](file:///D:/PROJECTS/MASS_MUTUAL/Loan-Default-Prediction-System/scripts/deploy_production.py), which automates all 5 release steps:

```powershell
.venv\Scripts\python.exe scripts/deploy_production.py
```

### What the Script Executes Automatically:
1. **Normalize & Package (`source.zip`):** Zips `app/`, `components/`, `lib/`, `ml/`, `public/`, and root build configs (`package.json`, `package-lock.json`, `next.config.mjs`, `postcss.config.mjs`, `components.json`, `tsconfig.json`, `next-env.d.ts`, `proxy.ts`, `Dockerfile`, `.dockerignore`, `buildspec.yml`) with **POSIX forward slashes (`/`)** so Linux Docker unpacks cleanly.
2. **Stage to S3:** Uploads `source.zip` to `s3://aegis-risk-storage-022671037337/build/source.zip`.
3. **Cloud Build & Poll:** Calls `aws codebuild start-build --project-name aegis-risk-build --region ap-southeast-2` and polls `batch-get-builds` every 10 seconds until `buildStatus == SUCCEEDED`.
4. **ECS Rolling Update:** Calls `aws ecs update-service --cluster aegis-risk-cluster --service aegis-risk-service --force-new-deployment --region ap-southeast-2`.
5. **CloudFront Edge Cache Invalidation:** Calls `aws cloudfront create-invalidation --distribution-id E2WK4WS85BY6CX --paths "/*"` so stale Next.js `s-maxage=31536000` edge caches are immediately evicted across all global PoPs.
6. **Cleanup:** Deletes the temporary local `source.zip`.

---

## 9. Post-Deployment Verification Commands

After a rollout completes, verify edge freshness, ECS task health, and routing with:

```powershell
# 1. Verify live domain headers (confirm X-Cache: Miss from cloudfront after invalidation)
curl.exe -I https://www.loansentry.in

# 2. Verify apex HTTP 301 redirect
curl.exe -I http://loansentry.in

# 3. Verify ECS Fargate primary deployment runningCount == 1
aws ecs describe-services --cluster aegis-risk-cluster --services aegis-risk-service --region ap-southeast-2 --query "services[0].deployments"
```
