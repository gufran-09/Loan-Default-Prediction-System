# AWS Concept: Private Container Registry (Amazon ECR)

## 1. Concept Definition
**Amazon Elastic Container Registry (ECR)** is a fully managed, high-availability OCI/Docker container image registry tightly integrated with AWS IAM, Amazon ECS, and AWS CodeBuild. It stores, encrypts, versions, and distributes container images over AWS's private internal network backbone with zero external Docker Hub rate limits.

---

## 2. Why Amazon ECR Was Chosen for Aegis Risk
Deploying a financial credit-scoring application requires secure, auditable, and reproducible software supply chains:
* **Private Artifact Isolation:** Unlike public registries, Aegis Risk's compiled application bundle, underwriting logic, and serialized XGBoost model (`ml/model.json`) remain strictly private inside AWS account `022671037337`.
* **Encryption at Rest & In Transit:** All image layers are automatically encrypted at rest using **AES-256** and transferred exclusively over HTTPS using short-lived IAM authorization tokens (`ecr:GetAuthorizationToken`).
* **Fast In-Region Pulls:** Hosting the registry in `ap-southeast-2` alongside CodeBuild and ECS Fargate ensures multi-stage image pushes and Fargate cold-start pulls complete in seconds with zero cross-region data transfer fees.
* **No Third-Party Rate Limits:** Avoids Docker Hub pull throttling during autoscaling events or rolling deployments.

---

## 3. How This Resource Was Created (Step-by-Step & AWS CLI)

### Step 1: Create the Private ECR Repository
```bash
aws ecr create-repository \
  --repository-name aegis-risk \
  --region ap-southeast-2
```
*Generated Repository URI:* `022671037337.dkr.ecr.ap-southeast-2.amazonaws.com/aegis-risk`  
*Repository ARN:* `arn:aws:ecr:ap-southeast-2:022671037337:repository/aegis-risk`  
*Encryption:* `AES256` | *Tag Mutability:* `MUTABLE`

### Step 2: Authenticate Docker Client to ECR via Temporary IAM Token
Inside AWS CodeBuild (`buildspec.yml` `pre_build` phase):
```bash
aws ecr get-login-password --region ap-southeast-2 \
  | docker login --username AWS --password-stdin 022671037337.dkr.ecr.ap-southeast-2.amazonaws.com
```

### Step 3: Build, Tag, and Push the Production Container Image
```bash
docker build -t 022671037337.dkr.ecr.ap-southeast-2.amazonaws.com/aegis-risk:latest .
docker push 022671037337.dkr.ecr.ap-southeast-2.amazonaws.com/aegis-risk:latest
```

### Step 4: Verify Pushed Image Digests
```bash
aws ecr list-images \
  --repository-name aegis-risk \
  --region ap-southeast-2
```

---

## 4. Integration in Aegis Risk
* **Repository Name:** `aegis-risk`
* **Repository URI:** `022671037337.dkr.ecr.ap-southeast-2.amazonaws.com/aegis-risk`
* **Active Image Tag:** `latest`
* **Region:** `ap-southeast-2`
* **Producer:** AWS CodeBuild project `aegis-risk-build` via [`buildspec.yml`](file:///d:/PROJECTS/MASS_MUTUAL/Loan-Default-Prediction-System/buildspec.yml)
* **Consumer:** Amazon ECS Fargate task definition `aegis-risk-task:1` (authorized via `ecsTaskExecutionRole`)

### Container Artifact Lifecycle:
```
    [ Multi-Stage Dockerfile ]
    (deps -> next build --webpack -> minimal node:20-alpine runner)
                  │
                  ▼
     [ AWS CodeBuild: docker push ]
     (Authenticated via IAM STS Token)
                  │
                  ▼
  ┌──────────────────────────────────────────────────────────┐
  │ Amazon ECR: 022671037337.dkr.ecr.ap-southeast-2.../aegis │
  │  - AES-256 Encrypted Image Layers                        │
  │  - Content-Addressed SHA-256 Digest                      │
  │  - Tag: :latest                                          │
  └───────────────────────────┬──────────────────────────────┘
                              │ (Private In-Region Pull)
                              ▼
       [ Amazon ECS Fargate Service: aegis-risk-service ]
```

---

## 5. Key Financial & Operational Takeaways
* **Immutable SHA-256 Provenance:** Every deployed container maps to a cryptographic SHA-256 digest in ECR, enabling deterministic rollbacks and audit traceability.
* **Minimal Footprint Storage Costs:** Combined with Next.js `output: 'standalone'` multi-stage builds (excluding dev dependencies and build caches), the final image footprint stays compact, keeping ECR storage costs negligible (~pennies per month).
* **Zero Static Credentials:** Neither CodeBuild nor ECS requires hardcoded registry passwords—both obtain ephemeral 12-hour tokens directly through IAM roles.
