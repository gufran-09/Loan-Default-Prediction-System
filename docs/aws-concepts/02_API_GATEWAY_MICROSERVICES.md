# AWS Concept: API Management & Edge Decoupling (Amazon API Gateway v2)

## 1. Concept Definition
An **API Gateway** acts as the single, managed entry point for client applications accessing backend services. It handles protocol translation, request routing, security verification, rate limiting, and Cross-Origin Resource Sharing (CORS) before traffic reaches compute runtimes. **API Gateway v2 (HTTP API)** is specifically optimized for low-latency, serverless REST microservices.

---

## 2. Why API Gateway Was Chosen for Aegis Risk
Directly exposing AWS Lambda functions to public web browsers poses security and architectural issues:
* **Tight Coupling:** Without an API gateway, changing backend implementation or migrating from Lambda to containerized ECS would require rewiring frontend network code.
* **CORS & Headers:** Handling pre-flight OPTIONS requests and header sanitization inside raw Python Lambda code adds boilerplate and latency.
* **DDoS & Traffic Spikes:** API Gateway provides built-in throttling and burst protection, safeguarding downstream ML inference services from runaway traffic.

---

## 3. How This Resource Was Created (Step-by-Step & AWS CLI)

The `aegis-risk-scoring-api` HTTP API Gateway was created and mapped to the Lambda scoring function via the AWS CLI:

### Step 1: Create the HTTP API with Lambda Target
```bash
aws apigatewayv2 create-api \
  --name aegis-risk-scoring-api \
  --protocol-type HTTP \
  --target arn:aws:lambda:ap-southeast-2:022671037337:function:aegis-risk-scoring-engine \
  --cors-configuration '{
    "AllowOrigins": ["*"],
    "AllowMethods": ["GET", "POST", "OPTIONS"],
    "AllowHeaders": ["Content-Type", "Authorization"]
  }' \
  --region ap-southeast-2
```
*Output generated API ID:* `a3q6b9scn0`  
*Target Endpoint:* `https://a3q6b9scn0.execute-api.ap-southeast-2.amazonaws.com/`

### Step 2: Grant API Gateway Permission to Invoke Lambda
To allow API Gateway to trigger the Lambda function across the AWS internal plane, an invocation permission was attached:
```bash
aws lambda add-permission \
  --function-name aegis-risk-scoring-engine \
  --statement-id apigateway-access \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:ap-southeast-2:022671037337:a3q6b9scn0/*" \
  --region ap-southeast-2
```

### Step 3: Default Route & Automatic Deployment
HTTP APIs (v2) automatically created the **`$default` route** pointing to the Lambda integration and enabled **Auto-Deploy**, making the live endpoint immediately accessible at `https://a3q6b9scn0.execute-api.ap-southeast-2.amazonaws.com/`.

---

## 4. Integration in Aegis Risk
* **Resource Type:** Amazon API Gateway v2 (HTTP API)
* **Endpoint URL:** `https://a3q6b9scn0.execute-api.ap-southeast-2.amazonaws.com/`
* **Route Configuration:** `$default` (proxies all methods and paths directly to the scoring Lambda)
* **Configured In:** [`.env`](file:///d:/Java-%20Backend/Project/Mass%20Mutual/ai-powered-loan-default-prediction-system/.env) under `LIVE_SCORING_API_ENDPOINT`

### Request / Response Lifecycle:
```
[Browser / Underwriter UI] 
            │  (HTTPS POST /score)
            ▼
[Amazon API Gateway v2] ──► Inspects headers, parses JSON payload, validates CORS
            │  (Proxies invocation event)
            ▼
[AWS Lambda Function]   ──► Computes probability of default & risk rating
            │  (Returns JSON result)
            ▼
[Amazon API Gateway v2] ──► Formats HTTP 200 response with gzip compression
            │
            ▼
[Next.js Client Engine] ──► Refreshes risk gauge and SHAP waterfall chart
```

---

## 5. Key Financial & Operational Takeaways
* **Sub-Millisecond Overhead:** HTTP APIs (v2) offer up to 70% lower latency and 71% cost reduction compared to legacy REST APIs (v1).
* **Decoupled Architecture:** The Next.js web tier in Vercel or local Node.js environments communicates strictly via standard HTTPS REST contracts, maintaining zero dependency on AWS SDK binary sizes in the web bundle.
