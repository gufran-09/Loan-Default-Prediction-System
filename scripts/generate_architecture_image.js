import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svg = `<svg width="1920" height="1080" viewBox="0 0 1920 1080" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1920" y2="1080" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#090E1A"/>
      <stop offset="50%" stop-color="#0E172B"/>
      <stop offset="100%" stop-color="#070B14"/>
    </linearGradient>

    <!-- Card Background Gradient -->
    <linearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#16223B" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#0F182A" stop-opacity="0.9"/>
    </linearGradient>

    <!-- Blue Glow Card -->
    <linearGradient id="blueCard" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1E3A8A" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#0F172A" stop-opacity="0.85"/>
    </linearGradient>

    <!-- Arrow Marker Cyan -->
    <marker id="arrowCyan" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#38BDF8"/>
    </marker>

    <!-- Arrow Marker Amber -->
    <marker id="arrowAmber" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#F59E0B"/>
    </marker>

    <!-- Soft Glow Filter -->
    <filter id="softGlow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#0284C7" flood-opacity="0.15"/>
    </filter>
  </defs>

  <style>
    .title { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-weight: 700; fill: #FFFFFF; }
    .subtitle { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-weight: 500; fill: #94A3B8; }
    .tier-label { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-weight: 600; font-size: 19px; fill: #CBD5E1; }
    .card-title { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-weight: 600; font-size: 15px; fill: #F8FAFC; }
    .card-sub { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-weight: 400; font-size: 12px; fill: #94A3B8; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  </style>

  <!-- Canvas Background -->
  <rect width="1920" height="1080" fill="url(#bgGrad)"/>

  <!-- Subtle Blueprint Tech Grid -->
  <g opacity="0.06">
    <path d="M0 60 H1920 M0 120 H1920 M0 180 H1920 M0 240 H1920 M0 300 H1920 M0 360 H1920 M0 420 H1920 M0 480 H1920 M0 540 H1920 M0 600 H1920 M0 660 H1920 M0 720 H1920 M0 780 H1920 M0 840 H1920 M0 900 H1920 M0 960 H1920 M0 1020 H1920" stroke="#38BDF8" stroke-width="1"/>
    <path d="M120 0 V1080 M240 0 V1080 M360 0 V1080 M480 0 V1080 M600 0 V1080 M720 0 V1080 M840 0 V1080 M960 0 V1080 M1080 0 V1080 M1200 0 V1080 M1320 0 V1080 M1440 0 V1080 M1560 0 V1080 M1680 0 V1080 M1800 0 V1080" stroke="#38BDF8" stroke-width="1"/>
  </g>

  <!-- Ambient Top Glowing Flares -->
  <circle cx="300" cy="0" r="400" fill="#0284C7" opacity="0.12" filter="blur(80px)"/>
  <circle cx="1600" cy="100" r="450" fill="#10B981" opacity="0.08" filter="blur(90px)"/>

  <!-- ==================== TOP HEADER ==================== -->
  <g transform="translate(60, 48)">
    <text class="title" font-size="32" y="0">Loan Sentry: AI-Powered Loan Default Prediction &amp; Explainable Underwriting Platform</text>
    <text class="subtitle" font-size="14" y="26">
      Production Enterprise Cloud Architecture • Target Institution: MassMutual Financial Group • Custom Domain: 
      <tspan fill="#38BDF8">https://www.loansentry.in</tspan> • Edge Security &amp; $0/mo Free Tier Strategy
    </text>
  </g>

  <!-- ==================== TIER 1: INGESTION & GLOBAL EDGE ==================== -->
  <g transform="translate(60, 115)">
    <!-- Row Container -->
    <rect width="1800" height="128" rx="14" fill="#0F172A" fill-opacity="0.6" stroke="#1E293B" stroke-width="1.5"/>
    <text class="tier-label" x="28" y="72">Ingestion &amp; Edge</text>

    <!-- Card 1: GoDaddy DNS & 301 Forwarding -->
    <g transform="translate(250, 16)">
      <rect width="330" height="96" rx="10" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.2"/>
      <!-- Globe Icon -->
      <circle cx="42" cy="48" r="22" fill="#0284C7" fill-opacity="0.2"/>
      <path d="M42 32 C33.16 32 26 39.16 26 48 C26 56.84 33.16 64 42 64 C50.84 64 58 56.84 58 48 C58 39.16 50.84 32 42 32 Z M29.5 48 C29.5 44.8 30.5 41.8 32.2 39.4 L39.4 46.6 C39.8 47 39.8 47.6 39.4 48 L35.2 52.2 C35 52.4 35 52.7 35.2 52.9 L37.1 54.8 C37.3 55 37.6 55 37.8 54.8 L42 50.6 L45.2 53.8 C45.6 54.2 46.2 54.2 46.6 53.8 L53.8 46.6 C54.2 46.2 54.2 45.6 53.8 45.2 L52 43.4 C51.8 43.2 51.5 43.2 51.3 43.4 L47 47.7 L44.3 45 C43.9 44.6 43.9 44 44.3 43.6 L50 37.9 C47.7 34.6 43.6 32.5 39 32.5 C33.8 32.5 29.5 36.8 29.5 42 Z" fill="#38BDF8"/>
      <text class="card-title" x="78" y="38">GoDaddy DNS &amp; 301 Apex</text>
      <text class="card-sub" x="78" y="56">loansentry.in (NIXI KYC Verified)</text>
      <text class="card-sub mono" font-size="11" fill="#64748B" x="78" y="74">RFC 1034 301 ➔ www.loansentry.in</text>
    </g>

    <!-- Arrow 1 to 2 -->
    <path d="M584 64 H610" stroke="#38BDF8" stroke-width="2" marker-end="url(#arrowCyan)"/>

    <!-- Card 2: AWS CloudFront CDN -->
    <g transform="translate(615, 16)">
      <rect width="360" height="96" rx="10" fill="url(#cardGrad)" stroke="#0284C7" stroke-width="1.5"/>
      <!-- CloudFront Icon -->
      <circle cx="42" cy="48" r="22" fill="#818CF8" fill-opacity="0.2"/>
      <path d="M42 34 L54 41 V55 L42 62 L30 55 V41 Z" fill="none" stroke="#A5B4FC" stroke-width="2"/>
      <circle cx="42" cy="48" r="5" fill="#A5B4FC"/>
      <text class="card-title" x="78" y="38">AWS CloudFront Global CDN</text>
      <text class="card-sub" x="78" y="56">d2eh1h9cfhciag.cloudfront.net</text>
      <text class="card-sub" fill="#10B981" x="78" y="74">Free Tier Flat Plan ($0/mo) • HYD57-P5 PoP</text>
    </g>

    <!-- Card 3: AWS ACM Wildcard SSL -->
    <g transform="translate(1005, 16)">
      <rect width="360" height="96" rx="10" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.2"/>
      <!-- Lock Icon -->
      <circle cx="42" cy="48" r="22" fill="#10B981" fill-opacity="0.2"/>
      <rect x="34" y="44" width="16" height="14" rx="3" fill="#34D399"/>
      <path d="M37 44 V39 C37 36.2 39.2 34 42 34 C44.8 34 47 36.2 47 39 V44" fill="none" stroke="#34D399" stroke-width="2"/>
      <text class="card-title" x="78" y="38">AWS ACM Public SSL (us-east-1)</text>
      <text class="card-sub" x="78" y="56">*.loansentry.in Wildcard TLS 1.3</text>
      <text class="card-sub" fill="#64748B" x="78" y="74">DNS-01 CNAME Validation &amp; Auto-Renew</text>
    </g>

    <!-- Card 4: AWS WAF Defense -->
    <g transform="translate(1395, 16)">
      <rect width="380" height="96" rx="10" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.2"/>
      <!-- Shield Icon -->
      <circle cx="42" cy="48" r="22" fill="#F43F5E" fill-opacity="0.2"/>
      <path d="M42 34 L52 38 V48 C52 55 42 61 42 61 C42 61 32 55 32 48 V38 Z" fill="#FB7185"/>
      <text class="card-title" x="78" y="38">AWS WAF Layer 7 Threat Shield</text>
      <text class="card-sub" x="78" y="56">Token Bucket Rate Limiting (2,000 req/5m)</text>
      <text class="card-sub" fill="#64748B" x="78" y="74">Managed Rules &amp; Bot Traffic Filter</text>
    </g>
  </g>

  <!-- Vertical Ingress Arrow from CloudFront to Load Balancer -->
  <path d="M795 243 V270" stroke="#38BDF8" stroke-width="2.5" marker-end="url(#arrowCyan)"/>

  <!-- ==================== TIER 2: COMPUTE & CONTAINER TIER ==================== -->
  <g transform="translate(60, 275)">
    <rect width="1800" height="128" rx="14" fill="#0F172A" fill-opacity="0.6" stroke="#1E293B" stroke-width="1.5"/>
    <text class="tier-label" x="28" y="62">Compute &amp;</text>
    <text class="tier-label" x="28" y="86">Container Tier</text>

    <!-- Card 1: AWS ALB -->
    <g transform="translate(250, 16)">
      <rect width="420" height="96" rx="10" fill="url(#cardGrad)" stroke="#0284C7" stroke-width="1.5"/>
      <!-- ALB Icon -->
      <circle cx="42" cy="48" r="22" fill="#0284C7" fill-opacity="0.2"/>
      <rect x="30" y="36" width="24" height="24" rx="4" fill="none" stroke="#38BDF8" stroke-width="2"/>
      <path d="M36 44 L42 50 L48 44" fill="none" stroke="#38BDF8" stroke-width="2"/>
      <text class="card-title" x="78" y="38">AWS Application Load Balancer (ALB)</text>
      <text class="card-sub" x="78" y="56">aegis-risk-alb-362464102.ap-southeast-2</text>
      <text class="card-sub" fill="#38BDF8" x="78" y="74">Origin Protocol: HTTP Port 80 • Target Group 3000</text>
    </g>

    <!-- Arrow ALB to ECS -->
    <path d="M674 64 H702" stroke="#38BDF8" stroke-width="2" marker-end="url(#arrowCyan)"/>

    <!-- Card 2: AWS ECS Fargate -->
    <g transform="translate(708, 16)">
      <rect width="520" height="96" rx="10" fill="url(#blueCard)" stroke="#3B82F6" stroke-width="1.5"/>
      <!-- Fargate Container Icon -->
      <circle cx="42" cy="48" r="22" fill="#3B82F6" fill-opacity="0.25"/>
      <rect x="31" y="37" width="22" height="22" rx="4" fill="#60A5FA"/>
      <text class="card-title" x="78" y="38">AWS ECS Fargate (Next.js 16 Standalone Container)</text>
      <text class="card-sub" x="78" y="56">Docker Multi-Stage • Alpine Linux • Non-Root User (UID 1001)</text>
      <text class="card-sub" fill="#10B981" x="78" y="74">Serverless 0.25 vCPU / 512MB RAM • Zero-Downtime Rolling Update</text>
    </g>

    <!-- Card 3: CI/CD Pipeline -->
    <g transform="translate(1258, 16)">
      <rect width="517" height="96" rx="10" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.2"/>
      <!-- CodePipeline Icon -->
      <circle cx="42" cy="48" r="22" fill="#EAB308" fill-opacity="0.2"/>
      <path d="M34 48 L42 40 L50 48 L42 56 Z" fill="none" stroke="#FACC15" stroke-width="2"/>
      <circle cx="42" cy="48" r="3" fill="#FACC15"/>
      <text class="card-title" x="78" y="38">AWS CodePipeline &amp; CodeBuild (CI/CD)</text>
      <text class="card-sub" x="78" y="56">buildspec.yml ➔ Multi-stage Build ➔ Amazon ECR Repository</text>
      <text class="card-sub" fill="#64748B" x="78" y="74">Automated Task Definition Revision &amp; Rolling Deployment</text>
    </g>
  </g>

  <!-- Vertical Arrow from ECS to Underwriter Cockpit -->
  <path d="M968 403 V430" stroke="#38BDF8" stroke-width="2.5" marker-end="url(#arrowCyan)"/>

  <!-- ==================== TIER 3: UNDERWRITER COCKPIT ==================== -->
  <g transform="translate(60, 435)">
    <rect width="1800" height="128" rx="14" fill="#0F172A" fill-opacity="0.6" stroke="#1E293B" stroke-width="1.5"/>
    <text class="tier-label" x="28" y="62">Underwriter</text>
    <text class="tier-label" x="28" y="86">Cockpit (UI)</text>

    <!-- Card 1: Next.js 16 UI Cockpit -->
    <g transform="translate(250, 16)">
      <rect width="1070" height="96" rx="10" fill="url(#cardGrad)" stroke="#38BDF8" stroke-width="1.5"/>
      <!-- Next.js Dark Round Logo -->
      <circle cx="42" cy="48" r="22" fill="#000000" stroke="#FFFFFF" stroke-width="1.5"/>
      <path d="M36 57 V39 L50 57 V39" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round"/>
      <text class="card-title" x="78" y="38">Next.js 16 App Router Cockpit with Recharts &amp; What-If Restructuring Simulator</text>
      <text class="card-sub" x="78" y="56">Overview Dashboard (/) • Full Table-Row Clickable Borrowers (/borrowers) • Alerts Desk (/alerts) • Portfolio (/analytics)</text>
      <text class="card-sub" fill="#38BDF8" x="78" y="74">Real-Time TreeSHAP Waterfall • Counterfactual Loan Modification • Adverse Action Notice Generator</text>
    </g>

    <!-- Card 2: AWS Cognito SSO -->
    <g transform="translate(1350, 16)">
      <rect width="425" height="96" rx="10" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.2"/>
      <!-- Cognito Icon -->
      <circle cx="42" cy="48" r="22" fill="#F43F5E" fill-opacity="0.2"/>
      <path d="M34 54 C34 49 38 46 42 46 C46 46 50 49 50 54" stroke="#FB7185" stroke-width="2"/>
      <circle cx="42" cy="41" r="5" stroke="#FB7185" stroke-width="2"/>
      <text class="card-title" x="78" y="38">AWS Cognito SSO Identity Pool</text>
      <text class="card-sub" x="78" y="56">User Pool: ap-southeast-2_80G23Am1X</text>
      <text class="card-sub" fill="#64748B" x="78" y="74">JWT Bearer Auth &amp; Role-Based Access Control</text>
    </g>
  </g>

  <!-- Vertical Arrow from UI to Scoring Seam -->
  <path d="M785 563 V590" stroke="#38BDF8" stroke-width="2.5" marker-end="url(#arrowCyan)"/>

  <!-- ==================== TIER 4: SCORING SEAM & ML TIER ==================== -->
  <g transform="translate(60, 595)">
    <rect width="1800" height="128" rx="14" fill="#0F172A" fill-opacity="0.6" stroke="#1E293B" stroke-width="1.5"/>
    <text class="tier-label" x="28" y="62">Scoring Seam &amp;</text>
    <text class="tier-label" x="28" y="86">ML Model Tier</text>

    <!-- Card 1: Decoupled Seam & API Gateway v2 -->
    <g transform="translate(250, 16)">
      <rect width="430" height="96" rx="10" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.2"/>
      <!-- API Gateway Icon -->
      <circle cx="42" cy="48" r="22" fill="#A855F7" fill-opacity="0.2"/>
      <rect x="33" y="39" width="18" height="18" fill="none" stroke="#C084FC" stroke-width="2"/>
      <path d="M42 35 V39 M42 57 V61 M35 42 H39 M57 42 H61" stroke="#C084FC" stroke-width="2"/>
      <text class="card-title" x="78" y="38">Amazon API Gateway v2 (HTTP API)</text>
      <text class="card-sub" x="78" y="56">Decoupled Seam: lib/scoring/getScore.ts</text>
      <text class="card-sub" fill="#C084FC" x="78" y="74">Low-Latency Sub-Millisecond Routing Layer</text>
    </g>

    <!-- Arrow API GW to Lambda -->
    <path d="M684 64 H712" stroke="#38BDF8" stroke-width="2" marker-end="url(#arrowCyan)"/>

    <!-- Card 2: AWS Lambda Serverless Scoring Engine -->
    <g transform="translate(718, 16)">
      <rect width="600" height="96" rx="10" fill="url(#cardGrad)" stroke="#F59E0B" stroke-width="1.5"/>
      <!-- Lambda Icon -->
      <circle cx="42" cy="48" r="22" fill="#F59E0B" fill-opacity="0.2"/>
      <path d="M34 58 L42 38 L48 50 L52 44" stroke="#FBBF24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <text class="card-title" x="78" y="38">AWS Lambda Serverless Scoring Engine (aegis-risk-scoring-engine)</text>
      <text class="card-sub" x="78" y="56">Calibrated XGBoost Model (scale_pos_weight = 6.48) • Platt Calibrator</text>
      <text class="card-sub" fill="#F59E0B" x="78" y="74">TreeSHAP Explainability Attributions • ECOA / FCRA Rationale</text>
    </g>

    <!-- Arrow Lambda to S3 -->
    <path d="M1322 64 H1348" stroke="#38BDF8" stroke-width="2" marker-end="url(#arrowCyan)"/>

    <!-- Card 3: Amazon S3 Model Lake -->
    <g transform="translate(1355, 16)">
      <rect width="420" height="96" rx="10" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.2"/>
      <!-- S3 Icon -->
      <circle cx="42" cy="48" r="22" fill="#10B981" fill-opacity="0.2"/>
      <ellipse cx="42" cy="42" rx="12" ry="4" stroke="#34D399" stroke-width="2" fill="none"/>
      <path d="M30 42 V54 C30 56.2 35.4 58 42 58 C48.6 58 54 56.2 54 54 V42" stroke="#34D399" stroke-width="2" fill="none"/>
      <text class="card-title" x="78" y="38">Amazon S3 Model Lake v2.0.0</text>
      <text class="card-sub" x="78" y="56">model.json, model.pkl, feature_columns.json</text>
      <text class="card-sub" fill="#64748B" x="78" y="74">Immutable Model Artifacts &amp; Drift Baselines</text>
    </g>
  </g>

  <!-- Vertical Arrow from Scoring Engine to Orchestration -->
  <path d="M1018 723 V750" stroke="#38BDF8" stroke-width="2.5" marker-end="url(#arrowCyan)"/>

  <!-- ==================== TIER 5: ORCHESTRATION ==================== -->
  <g transform="translate(60, 755)">
    <rect width="1800" height="128" rx="14" fill="#0F172A" fill-opacity="0.6" stroke="#1E293B" stroke-width="1.5"/>
    <text class="tier-label" x="28" y="72">Orchestration</text>

    <!-- Card 1: AWS Step Functions Header -->
    <g transform="translate(250, 16)">
      <rect width="480" height="96" rx="10" fill="url(#cardGrad)" stroke="#EC4899" stroke-width="1.5"/>
      <!-- Step Functions Icon -->
      <circle cx="42" cy="48" r="22" fill="#EC4899" fill-opacity="0.2"/>
      <rect x="33" y="35" width="10" height="10" rx="2" fill="#F472B6"/>
      <rect x="45" y="47" width="10" height="10" rx="2" fill="#F472B6"/>
      <path d="M43 40 H47 V47" stroke="#F472B6" stroke-width="1.5"/>
      <text class="card-title" x="78" y="38">AWS Step Functions State Machine</text>
      <text class="card-sub" x="78" y="56">Aegis-Risk-Credit-Decisioning</text>
      <text class="card-sub" fill="#F472B6" x="78" y="74">Straight-Through Processing (STP) Execution Flow</text>
    </g>

    <!-- Branch Arrows -->
    <path d="M734 64 H768" stroke="#38BDF8" stroke-width="2" marker-end="url(#arrowCyan)"/>

    <!-- Branch 1: Auto-Approve (Emerald) -->
    <g transform="translate(775, 20)">
      <rect width="310" height="88" rx="8" fill="#064E3B" fill-opacity="0.5" stroke="#10B981" stroke-width="1.5"/>
      <circle cx="32" cy="44" r="14" fill="#10B981" fill-opacity="0.3"/>
      <path d="M26 44 L30 48 L38 38" stroke="#34D399" stroke-width="2.5" stroke-linecap="round"/>
      <text class="card-title" fill="#34D399" x="58" y="36">Auto-Approve Rule</text>
      <text class="card-sub" x="58" y="54">Calibrated PD &lt; 0.450</text>
      <text class="card-sub" fill="#A7F3D0" x="58" y="70">Instant STP Loan Approval</text>
    </g>

    <!-- Branch 2: Refer to Underwriter (Amber) -->
    <g transform="translate(1115, 20)">
      <rect width="320" height="88" rx="8" fill="#78350F" fill-opacity="0.4" stroke="#F59E0B" stroke-width="1.5"/>
      <circle cx="32" cy="44" r="14" fill="#F59E0B" fill-opacity="0.3"/>
      <circle cx="32" cy="44" r="3" fill="#FBBF24"/>
      <text class="card-title" fill="#FBBF24" x="58" y="36">Refer to Underwriter</text>
      <text class="card-sub" x="58" y="54">0.450 &lt;= Calibrated PD &lt; 0.650</text>
      <text class="card-sub" fill="#FDE68A" x="58" y="70">Human-In-The-Loop Review</text>
    </g>

    <!-- Branch 3: Auto-Decline (Rose) -->
    <g transform="translate(1465, 20)">
      <rect width="310" height="88" rx="8" fill="#881337" fill-opacity="0.4" stroke="#F43F5E" stroke-width="1.5"/>
      <circle cx="32" cy="44" r="14" fill="#F43F5E" fill-opacity="0.3"/>
      <path d="M26 38 L38 50 M38 38 L26 50" stroke="#FB7185" stroke-width="2.5" stroke-linecap="round"/>
      <text class="card-title" fill="#FB7185" x="58" y="36">Auto-Decline Rule</text>
      <text class="card-sub" x="58" y="54">Calibrated PD &gt;= 0.650</text>
      <text class="card-sub" fill="#FECDD3" x="58" y="70">Adverse Action Notice</text>
    </g>
  </g>

  <!-- Vertical Fanout Arrows from Orchestration to Institutional Services -->
  <path d="M930 883 V910" stroke="#10B981" stroke-width="2" marker-end="url(#arrowCyan)"/>
  <path d="M1275 883 V910" stroke="#F59E0B" stroke-width="2" marker-end="url(#arrowAmber)"/>
  <path d="M1620 883 V910" stroke="#F43F5E" stroke-width="2" marker-end="url(#arrowCyan)"/>

  <!-- ==================== TIER 6: INSTITUTIONAL SERVICES ==================== -->
  <g transform="translate(60, 915)">
    <rect width="1800" height="128" rx="14" fill="#0F172A" fill-opacity="0.6" stroke="#1E293B" stroke-width="1.5"/>
    <text class="tier-label" x="28" y="62">Institutional</text>
    <text class="tier-label" x="28" y="86">Services</text>

    <!-- 1. Amazon Bedrock GenAI Memo -->
    <g transform="translate(250, 16)">
      <rect width="285" height="96" rx="10" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.2"/>
      <circle cx="36" cy="48" r="18" fill="#10B981" fill-opacity="0.2"/>
      <path d="M30 48 C30 42 36 40 36 40 C36 40 42 42 42 48 C42 54 36 56 36 56" stroke="#34D399" stroke-width="2" fill="none"/>
      <text class="card-title" font-size="14" x="66" y="36">Amazon Bedrock</text>
      <text class="card-sub" x="66" y="54">Claude 3.5 Haiku GenAI</text>
      <text class="card-sub" fill="#34D399" x="66" y="72">Automated Credit Memos</text>
    </g>

    <!-- 2. Amazon RDS PostgreSQL 16 -->
    <g transform="translate(555, 16)">
      <rect width="285" height="96" rx="10" fill="url(#cardGrad)" stroke="#38BDF8" stroke-width="1.4"/>
      <circle cx="36" cy="48" r="18" fill="#0284C7" fill-opacity="0.2"/>
      <ellipse cx="36" cy="42" rx="10" ry="3" stroke="#38BDF8" stroke-width="1.8" fill="none"/>
      <path d="M26 42 V54 C26 55.5 30.5 57 36 57 C41.5 57 46 55.5 46 54 V42" stroke="#38BDF8" stroke-width="1.8" fill="none"/>
      <text class="card-title" font-size="14" x="66" y="36">Amazon RDS PostgreSQL</text>
      <text class="card-sub" x="66" y="54">Engine: v16 (aegis-risk-db)</text>
      <text class="card-sub" fill="#64748B" x="66" y="72">+ Supabase Fallback Sync</text>
    </g>

    <!-- 3. Amazon CloudWatch Logs -->
    <g transform="translate(860, 16)">
      <rect width="285" height="96" rx="10" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.2"/>
      <circle cx="36" cy="48" r="18" fill="#F43F5E" fill-opacity="0.2"/>
      <path d="M28 52 L34 46 L39 49 L44 42" stroke="#FB7185" stroke-width="2" stroke-linecap="round"/>
      <text class="card-title" font-size="14" x="66" y="36">Amazon CloudWatch</text>
      <text class="card-sub" x="66" y="54">/aegis-risk/audit-trail</text>
      <text class="card-sub" fill="#FB7185" x="66" y="72">OCC SR 11-7 Audit Trail</text>
    </g>

    <!-- 4. Amazon SNS Alerts -->
    <g transform="translate(1165, 16)">
      <rect width="285" height="96" rx="10" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.2"/>
      <circle cx="36" cy="48" r="18" fill="#EC4899" fill-opacity="0.2"/>
      <circle cx="36" cy="48" r="4" fill="#F472B6"/>
      <path d="M28 48 C28 43 32 40 36 40 C40 40 44 43 44 48" stroke="#F472B6" stroke-width="1.8" fill="none"/>
      <text class="card-title" font-size="14" x="66" y="36">Amazon SNS Topic</text>
      <text class="card-sub" x="66" y="54">aegis-risk-critical-alerts</text>
      <text class="card-sub" fill="#F472B6" x="66" y="72">Real-Time Risk Broadcast</text>
    </g>

    <!-- 5. Meta WhatsApp Cloud API -->
    <g transform="translate(1470, 16)">
      <rect width="305" height="96" rx="10" fill="url(#cardGrad)" stroke="#10B981" stroke-width="1.4"/>
      <!-- WhatsApp Icon -->
      <circle cx="36" cy="48" r="18" fill="#10B981" fill-opacity="0.25"/>
      <path d="M43.5 40.5 C41.5 38.5 38.8 37.5 36 37.5 C30.2 37.5 25.5 42.2 25.5 48 C25.5 50.3 26.2 52.5 27.5 54.3 L26 60 L31.8 58.5 C33.5 59.5 34.7 60 36 60 C41.8 60 46.5 55.3 46.5 49.5 C46.5 46.7 45.5 44 43.5 40.5 Z" fill="#22C55E"/>
      <text class="card-title" font-size="14" x="66" y="36">Meta WhatsApp Cloud API</text>
      <text class="card-sub" x="66" y="54">Template: credit_decision_alert</text>
      <text class="card-sub" fill="#22C55E" x="66" y="72">Alerts ➔ +91 8688032272</text>
    </g>
  </g>
</svg>`;

async function main() {
  const outputPathPng = path.join(__dirname, '..', 'docs', 'architecture', 'loan_sentry_architecture.png');
  const publicPathPng = path.join(__dirname, '..', 'public', 'architecture.png');
  const svgPath = path.join(__dirname, '..', 'docs', 'architecture', 'loan_sentry_architecture.svg');

  fs.writeFileSync(svgPath, svg);
  console.log('Saved SVG:', svgPath);

  // Render high-res PNG (1920x1080)
  await sharp(Buffer.from(svg))
    .png({ quality: 100 })
    .toFile(outputPathPng);
  console.log('Saved PNG to:', outputPathPng);

  fs.copyFileSync(outputPathPng, publicPathPng);
  console.log('Copied PNG to public:', publicPathPng);
}

main().catch(console.error);
