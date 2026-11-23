# Loan Sentry — Complete End-to-End System Architecture Topology

**System Name:** Loan Sentry (formerly Aegis Risk)  
**Enterprise Target:** MassMutual Financial Group (Institutional Credit Risk & Default Prediction)  
**Production Domain:** [https://www.loansentry.in](https://www.loansentry.in) (Apex: [http://loansentry.in](http://loansentry.in))  
**Cloud Providers:** Amazon Web Services (AWS Multi-Region: `us-east-1` & `ap-southeast-2`) + Meta Cloud Platform  
**Document Classification:** Master Architectural Specification & Infrastructure Topology  

---

## 1. Master System Architecture Diagram

```mermaid
flowchart TD
    %% Global Edge & DNS Layer
    subgraph Layer1 ["1. Global Edge, DNS & Security Ingress Layer"]
        CLIENT["Risk Officer / Underwriter Web Browser"]
        GODADDY["GoDaddy Authoritative DNS<br/>loansentry.in Zone File (NIXI KYC Verified)"]
        FWD["GoDaddy 301 Forwarding Proxy<br/>http://loansentry.in to https://www.loansentry.in (RFC 1034)"]
        CF["AWS CloudFront Global CDN<br/>Distribution: E2WK4WS85BY6CX<br/>d2eh1h9cfhciag.cloudfront.net (Free $0/mo Tier)"]
        ACM["AWS Certificate Manager (us-east-1)<br/>Public Wildcard TLS 1.3: *.loansentry.in"]
        WAF["AWS WAF Edge Defense<br/>Token Bucket Rate Limiting (2,000 req/5min)"]
        EDGE_POP["AWS Edge PoP (HYD57-P5 Hyderabad)<br/>139ms Latency & Static Asset Edge Caching"]
    end

    %% CI/CD & Container Registry
    subgraph Layer2 ["2. Container Orchestration & CI/CD Pipeline (ap-southeast-2)"]
        GITHUB["Git Repository (Branch: main)"]
        CODEBUILD["AWS CodeBuild (buildspec.yml)<br/>Multi-Stage Node 20 Standalone Build"]
        ECR["Amazon Elastic Container Registry (ECR)<br/>Docker Image Repository"]
        ALB["AWS Application Load Balancer<br/>aegis-risk-alb-362464102 (HTTP Port 80 Origin)"]
        TG["ALB Target Group<br/>Health Check: GET /api/health (200 OK)"]
        FARGATE["AWS ECS Fargate Cluster<br/>Next.js 16 Standalone Container (Port 3000)<br/>Non-Root User: nextjs:nodejs (UID 1001)"]
    end

    %% Presentation & Cockpit
    subgraph Layer3 ["3. Underwriter Cockpit & Client Layer (Next.js 16 App Router)"]
        COGNITO["AWS Cognito User Pool<br/>ap-southeast-2_80G23Am1X (SSO Authentication)"]
        SHELL["Institutional Shell (components/dashboard/shell.tsx)"]
        PAGE_OVERVIEW["Portfolio Overview Dashboard (/)"]
        PAGE_BORROWERS["Borrowers Directory & Full Row Click (/borrowers)"]
        PAGE_DETAIL["Borrower Dossier & What-If Simulator (/borrowers/:id)"]
        PAGE_ALERTS["Alerts Triage Operations Desk (/alerts)"]
        PAGE_ANALYTICS["Portfolio Expected Loss & Model Drift (/analytics)"]
    end

    %% Scoring Seam & ML Compute
    subgraph Layer4 ["4. Scoring Seam & Machine Learning Inference Tier"]
        SEAM["Decoupled Scoring Seam Router (lib/scoring/getScore.ts)"]
        APIGW["Amazon API Gateway v2<br/>HTTP API (Sub-millisecond Routing)"]
        LAMBDA["AWS Lambda Scoring Engine<br/>aegis-risk-scoring-engine"]
        MODEL_XGB["Calibrated XGBoost Model<br/>scale_pos_weight = 6.48 (ml/model.json)"]
        SHAP["TreeSHAP Explainer<br/>ECOA/FCRA Feature Attributions"]
        CALIBRATOR["Isotonic / Platt Probability Calibrator"]
        S3["Amazon S3 Model Lake<br/>Model Lake v2.0.0 Artifacts"]
    end

    %% Orchestration & Policy Routing
    subgraph Layer5 ["5. Straight-Through Processing (STP) Orchestration"]
        STEPFN["AWS Step Functions State Machine<br/>Aegis-Risk-Credit-Decisioning"]
        RULE_APPROVE{"Auto-Approve Rule<br/>PD < 450 & Clean Credit"}
        RULE_REVIEW{"Manual Review Rule<br/>450 <= PD < 650"}
        RULE_DECLINE{"Auto-Decline Rule<br/>PD >= 650 (Adverse Action)"}
    end

    %% Institutional Data & External Services
    subgraph Layer6 ["6. Institutional Services, Data Persistence & Messaging Mesh"]
        RDS["Amazon RDS PostgreSQL 16<br/>aegis-risk-db (borrowers, risk_scores, alerts)"]
        SUPABASE["Supabase PostgreSQL<br/>Development & Fallback Storage"]
        BEDROCK["Amazon Bedrock Runtime<br/>Claude 3.5 Haiku GenAI Underwriting Memos"]
        CLOUDWATCH["Amazon CloudWatch Logs<br/>/aegis-risk/audit-trail (OCC SR 11-7 Audit Trail)"]
        SNS["Amazon SNS Topic<br/>aegis-risk-critical-alerts"]
        CIRCUIT["Opossum Circuit Breaker<br/>(lib/resilience/circuitBreaker.ts)"]
        WHATSAPP["Meta WhatsApp Business Cloud API (v21.0)<br/>Template: credit_decision_alert<br/>Phone ID: 1349662911564332"]
        OFFICER["Officer Recipient Device<br/>+91 8688032272 (Verified Loan Officer)"]
    end

    %% Ingress Connections
    CLIENT -->|1. DNS Lookup: www.loansentry.in| GODADDY
    CLIENT -->|1a. GET http://loansentry.in| FWD
    FWD -->|HTTP 301 Redirect to https://www.loansentry.in| CLIENT
    GODADDY -->|CNAME alias| CF
    CF --- ACM
    CF --- WAF
    CF --- EDGE_POP
    CLIENT -->|2. HTTPS TLS 1.3 Request| CF

    %% Edge to Compute Connections
    CF -->|3. HTTP/80 Private Backbone Request| ALB
    ALB --> TG --> FARGATE

    %% CI/CD flow
    GITHUB -->|git push origin main| CODEBUILD
    CODEBUILD -->|docker push| ECR
    ECR -->|Rolling Task Replacement| FARGATE

    %% Presentation Connections
    FARGATE --> SHELL
    COGNITO -.->|JWT Session SSO| SHELL
    SHELL --> PAGE_OVERVIEW & PAGE_BORROWERS & PAGE_DETAIL & PAGE_ALERTS & PAGE_ANALYTICS

    %% Scoring Seam flow
    PAGE_DETAIL & PAGE_BORROWERS -->|Execute Scoring Request| SEAM
    SEAM -->|Primary Live Inference| APIGW --> LAMBDA
    LAMBDA <--> S3
    LAMBDA --> MODEL_XGB & SHAP & CALIBRATOR

    %% Step Functions Workflow
    SEAM -->|Trigger Orchestration| STEPFN
    STEPFN --> RULE_APPROVE & RULE_REVIEW & RULE_DECLINE

    %% Institutional Services & Persistence
    FARGATE -->|SQL Queries Pool| RDS
    RDS -.->|Fallback Sync| SUPABASE
    PAGE_DETAIL -->|Generate Executive Memo| BEDROCK
    SEAM & STEPFN & FARGATE -->|Immutable Audit Telemetry| CLOUDWATCH
    STEPFN & SEAM -->|High Risk Volumetric Alerts| SNS
    PAGE_DETAIL & FARGATE -->|Direct Officer Alert| CIRCUIT
    CIRCUIT -->|POST /messages Bearer System Token| WHATSAPP
    WHATSAPP -->|Dispatch WhatsApp Alert| OFFICER
```

---

## 2. Comprehensive Layer-by-Layer Inventory

### Layer 1: Global Edge, DNS & Security Ingress Layer
| Component | Provider / Technology | Specific Resource / Configuration | Role in System |
| :--- | :--- | :--- | :--- |
| **Domain Registrar & DNS** | GoDaddy | `loansentry.in` Zone File | Holds authoritative DNS records; NIXI digital KYC clearance completed. |
| **Apex Forwarding Proxy** | GoDaddy Forwarding Engine | `http://loansentry.in` ➔ `https://www.loansentry.in` | Issues an HTTP 301 Permanent Redirect to satisfy RFC 1034 apex CNAME constraints. |
| **Global Anycast CDN** | AWS CloudFront | Distribution: `E2WK4WS85BY6CX`<br/>Domain: `d2eh1h9cfhciag.cloudfront.net` | Terminates viewer TLS 1.3 globally, caches Next.js static assets, provides Free Flat-Rate Tier ($0/mo). |
| **SSL / TLS Certificate** | AWS Certificate Manager (ACM) | Region: `us-east-1` (N. Virginia)<br/>ARN: `da5d1012-f60d-4c37-a29e-4759e7e7066e` | Public wildcard certificate covering `loansentry.in` and `*.loansentry.in`. |
| **Layer 7 Edge Defense** | AWS WAF | CloudFront Managed WebACL | Token-bucket rate limiting (2,000 requests / 5 minutes) and automated DDoS shield. |
| **Edge Cache PoP** | AWS CloudFront Edge PoP | `HYD57-P5` (Hyderabad, India) | Delivers sub-15ms edge TCP/TLS handshakes and ~139ms total page delivery in India. |

---

### Layer 2: Container Orchestration & CI/CD Pipeline (`ap-southeast-2`)
| Component | Provider / Technology | Specific Resource / Configuration | Role in System |
| :--- | :--- | :--- | :--- |
| **Layer 7 Load Balancer** | AWS Application Load Balancer | `aegis-risk-alb-362464102.ap-southeast-2.elb.amazonaws.com` | Reverse proxy receiving HTTP port 80 traffic from CloudFront; path-based routing. |
| **Target Group** | AWS ALB Target Group | Port 3000 / Protocol: HTTP | Monitors backend container availability via `GET /api/health` probes every 30s. |
| **Serverless Compute** | AWS ECS Fargate | Task Definition: 0.25 vCPU, 512 MB RAM | Executes containerized Next.js 16 standalone server without provisioning EC2 VMs. |
| **Container Image** | Docker / Node.js 20 Alpine | `Dockerfile` (Multi-stage build) | Ultra-lightweight standalone build (~180 MB) running as non-root user `nextjs:nodejs`. |
| **Container Registry** | Amazon ECR | Private Repository | Stores immutable versioned production Docker image tags. |
| **CI/CD Build Runner** | AWS CodeBuild / CodePipeline | `buildspec.yml` | Automatically compiles Docker image and triggers zero-downtime rolling task replacements on Git push. |

---

### Layer 3: Underwriter Cockpit & Client Presentation Tier
| Component | Provider / Technology | Specific Resource / Configuration | Role in System |
| :--- | :--- | :--- | :--- |
| **User Directory & SSO** | AWS Cognito | User Pool: `ap-southeast-2_80G23Am1X`<br/>Client ID: `74120ugqosjjpmup4utltl1oqf` | Underwriter authentication, MFA, and JWT session token generation. |
| **Web Framework** | Next.js 16 (React 19) | App Router, Server Components & Client Hooks | High-performance institutional underwriting dashboard. |
| **UI Design System** | Tailwind CSS + Lucide Icons | Dark/Light Mode Theme Provider | Polished banking dashboard styling with responsive mobile drawer navigation. |
| **Data Visualizations** | Recharts (SVG Charts) | AreaCharts, BarCharts, Custom Gauges | Interactive default risk deciles, delinquency distributions, and score breakdowns. |
| **What-If Loan Simulator** | React State + Seam APIs | `/borrowers/[id]` Cockpit | Real-time counterfactual credit restructuring (adjusting loan amount, term, rate, DTI). |
| **Audit CSV Export** | Client-Side CSV Serializer | `lib/export/csv.ts` | One-click regulatory audit exports for alerts, borrower cohorts, and portfolio statistics. |

---

### Layer 4: Scoring Seam & Machine Learning Inference Tier
| Component | Provider / Technology | Specific Resource / Configuration | Role in System |
| :--- | :--- | :--- | :--- |
| **Scoring Seam** | TypeScript Architectural Pattern | `lib/scoring/getScore.ts` | Decoupled abstraction routing inference requests between AWS Lambda and local fallback. |
| **Inference API Gateway** | Amazon API Gateway v2 | HTTP API | Low-latency, sub-millisecond API proxy routing requests to Lambda scoring workers. |
| **Serverless Scoring Worker** | AWS Lambda | `aegis-risk-scoring-engine` | Executes XGBoost inference within a 15-second timeout budget. |
| **Core ML Model** | XGBoost 1.7+ Classifier | `scale_pos_weight = 6.48` (`ml/model.json`) | Trained on 168k seasoned cohort loans with calibrated default probability prediction. |
| **Explainable AI (XAI)** | TreeSHAP | Python `shap` / JSON Feature Attribution Maps | Extracts top 4 principal credit factors for ECOA / FCRA fair lending compliance. |
| **Probability Calibration** | Platt / Isotonic Calibration | `ml/calibrator.pkl` | Transforms raw gradient boosting margins into true empirical default probabilities. |
| **Model Lake** | Amazon S3 | `s3://.../aegis-risk-model-lake/v2.0.0/` | Versioned storage of model artifacts (`model.pkl`, `model.json`, `feature_columns.json`). |

---

### Layer 5: Orchestration & Straight-Through Processing (STP) Tier
| Component | Provider / Technology | Specific Resource / Configuration | Role in System |
| :--- | :--- | :--- | :--- |
| **State Machine Engine** | AWS Step Functions | `arn:aws:states:ap-southeast-2:022671037337:stateMachine:Aegis-Risk-Credit-Decisioning` | Manages complex, auditable multi-step underwriting workflows. |
| **Auto-Approve Branch** | Deterministic Policy Node | Calibrated PD < 0.45 & DTI < 35% | Straight-through instant loan approval for prime credit applicants. |
| **Manual Review Branch** | Human-in-the-Loop Node | 0.45 <= Calibrated PD < 0.65 | Routes borderline applications to senior credit officers with TreeSHAP visual guidance. |
| **Auto-Decline Branch** | Adverse Action Trigger | Calibrated PD >= 0.65 | Automatically generates Adverse Action records citing top SHAP negative factors. |

---

### Layer 6: Institutional Services, Data Persistence & Messaging Mesh
| Component | Provider / Technology | Specific Resource / Configuration | Role in System |
| :--- | :--- | :--- | :--- |
| **Primary Relational DB** | Amazon RDS PostgreSQL 16 | `aegis-risk-db.c1wu2mekybkk.ap-southeast-2.rds.amazonaws.com` | ACID storage for `borrowers`, `risk_scores`, `risk_reasons`, and `alerts` tables. |
| **Fallback Database** | Supabase PostgreSQL | `lib/supabase/client.ts` | Multi-cloud disaster recovery and development backup database. |
| **Generative AI Memos** | Amazon Bedrock Runtime | Anthropic Claude 3.5 Haiku | Generates synthesized, formal credit underwriting memos based on SHAP metrics. |
| **Audit Logging & Telemetry** | Amazon CloudWatch Logs | `/aegis-risk/audit-trail` | Immutable regulatory event logging complying with Federal Reserve **OCC SR 11-7**. |
| **Risk Push Notifications** | Amazon SNS | `aegis-risk-critical-alerts` | Instant fanout pub/sub messaging for catastrophic portfolio delinquency spikes. |
| **Resilience Layer** | Opossum Circuit Breaker | `lib/resilience/circuitBreaker.ts` | Isolates backend threads from external API latency spikes and network failures. |
| **Borrower Outbound Alerts** | Meta WhatsApp Cloud API v21.0 | Phone ID: `1349662911564332`<br/>WABA: `2350081079116052` | Direct enterprise WhatsApp alert dispatch via approved `credit_decision_alert` template. |
| **Verified Recipient** | WhatsApp Client Device | Phone: `+91 8688032272` | Verified underwriting loan officer receiving live credit decision notifications. |

---
*Loan Sentry Enterprise Cloud Architecture Specification — Version 2.0.0 — November 2026*
