# AWS Concept: Serverless Container Orchestration (Amazon ECS & AWS Fargate)

## 1. Concept Definition
**Amazon Elastic Container Service (ECS)** is a fully managed container orchestration platform that deploys, scales, and heals Docker containers across AWS. When paired with the **AWS Fargate** serverless launch type, AWS manages the entire underlying compute layer—provisioning isolated micro-VMs per task with zero EC2 instances to patch, SSH into, or capacity-plan.

---

## 2. Why Amazon ECS Fargate Was Chosen for Aegis Risk
Aegis Risk is a full-stack **Next.js 16** application combining server-rendered React UI, dynamic API routes, real-time XGBoost inference fallback (`ml/model.json`), PostgreSQL connection pooling, and AWS SDK integrations:
* **Zero Server Administration:** Unlike self-managed EC2 hosts, Fargate runs our hardened Alpine container (`node:20-alpine`) as a non-root user (`nextjs`, UID `1001`) without requiring OS security patching or daemon tuning.
* **Sub-5ms In-Region RDS Latency:** Running inside the same `ap-southeast-2` VPC as Amazon RDS PostgreSQL yields **4 ms** database query latency—critical for real-time underwriting dashboards.
* **Zero-Downtime Rolling Deployments:** When a new container image is pushed to ECR, ECS launches the replacement Fargate task, waits for it to pass Application Load Balancer `/api/health` checks, shifts traffic seamlessly, and only then drains the previous task.
* **Automatic Self-Healing:** If a container crashes or fails health probes, the ECS Service Scheduler automatically terminates the unhealthy task and provisions a fresh replacement to maintain `desiredCount = 1`.
* **Native IAM Task Roles:** Separates infrastructure permissions (`ecsTaskExecutionRole` for pulling ECR images and shipping logs) from application permissions (`aegis-risk-ecs-task-role` for Cognito, Bedrock, S3, SNS, and Textract) without embedding static AWS access keys in environment variables.

---

## 3. How This Resource Was Created (Step-by-Step & AWS CLI)

### Step 1: Create the ECS Cluster
```bash
aws ecs create-cluster \
  --cluster-name aegis-risk-cluster \
  --region ap-southeast-2
```
*Cluster ARN:* `arn:aws:ecs:ap-southeast-2:022671037337:cluster/aegis-risk-cluster`

### Step 2: Create IAM Execution Role & Runtime Task Role
```bash
# 1. Execution Role (pulls image from ECR & streams logs to CloudWatch)
aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document file://ecs-trust.json

aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# 2. Application Task Role (runtime access to Cognito, S3, SNS, Bedrock, Textract)
aws iam create-role \
  --role-name aegis-risk-ecs-task-role \
  --assume-role-policy-document file://ecs-trust.json

aws iam put-role-policy \
  --role-name aegis-risk-ecs-task-role \
  --policy-name aegis-risk-runtime-aws-access \
  --policy-document file://ecs-task-policy.json
```

### Step 3: Create the CloudWatch Log Group for Container Telemetry
```bash
aws logs create-log-group \
  --log-group-name /ecs/aegis-risk \
  --region ap-southeast-2
```

### Step 4: Register the Fargate Task Definition (`aegis-risk-task:1`)
```bash
aws ecs register-task-definition \
  --cli-input-json file://ecs-task-def.json \
  --region ap-southeast-2
```
*Key Task Specifications:*
* **Launch Type:** `FARGATE` (`awsvpc` network mode)
* **Compute Allocation:** `1024 CPU` (1 vCPU) / `2048 MiB` (2 GB RAM)
* **Container Image:** `022671037337.dkr.ecr.ap-southeast-2.amazonaws.com/aegis-risk:latest`
* **Container Port:** `3000/tcp`
* **Log Driver:** `awslogs` -> `/ecs/aegis-risk`

### Step 5: Launch the ECS Service Behind the Application Load Balancer
```bash
aws ecs create-service \
  --cluster aegis-risk-cluster \
  --service-name aegis-risk-service \
  --task-definition aegis-risk-task:1 \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-065ca276963711132,subnet-038b55a3e484c9247],securityGroups=[sg-0b4fcc9c3c0928028],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:ap-southeast-2:022671037337:targetgroup/aegis-risk-tg/b0981e52a86017eb,containerName=aegis-risk,containerPort=3000" \
  --region ap-southeast-2
```

### Step 6: Trigger Zero-Downtime Rolling Updates
Whenever a new image is pushed to ECR, ECS rolls out the update cleanly:
```bash
aws ecs update-service \
  --cluster aegis-risk-cluster \
  --service aegis-risk-service \
  --force-new-deployment \
  --region ap-southeast-2
```

---

## 4. Integration in Aegis Risk
* **Cluster Name:** `aegis-risk-cluster`
* **Service Name:** `aegis-risk-service`
* **Task Definition:** `arn:aws:ecs:ap-southeast-2:022671037337:task-definition/aegis-risk-task:1`
* **Execution Role:** `arn:aws:iam::022671037337:role/ecsTaskExecutionRole`
* **Task Role:** `arn:aws:iam::022671037337:role/aegis-risk-ecs-task-role`
* **Container Log Group:** `/ecs/aegis-risk`
* **Container Definition:** [`Dockerfile`](file:///d:/PROJECTS/MASS_MUTUAL/Loan-Default-Prediction-System/Dockerfile) (3-stage Next.js `standalone` build running `node server.js`)
* **Health Probe Endpoint:** [`app/api/health/route.ts`](file:///d:/PROJECTS/MASS_MUTUAL/Loan-Default-Prediction-System/app/api/health/route.ts)

### ECS Fargate Runtime Architecture:
```
           [ Application Load Balancer: aegis-risk-alb ]
                              │ (HTTP :3000)
                              ▼
         ┌───────────────────────────────────────────────┐
         │      Amazon ECS Cluster: aegis-risk-cluster   │
         │   ┌───────────────────────────────────────┐   │
         │   │  Fargate Task (1 vCPU / 2 GB, awsvpc) │   │
         │   │  Container: aegis-risk (Next.js 16)   │   │
         │   │  User: nextjs (UID 1001, non-root)    │   │
         │   └──────┬──────────────┬─────────────────┘   │
         └──────────┼──────────────┼─────────────────────┘
                    │              │
        ┌───────────▼──────┐  ┌────▼───────────────────────────┐
        │ Execution Role   │  │ Task Role (Runtime AWS SDK)    │
        │ - Pull ECR Image │  │ - Cognito IDP / S3 / SNS       │
        │ - Ship Logs      │  │ - Bedrock / Textract / SFN     │
        │   (/ecs/aegis..) │  │ - RDS PostgreSQL (4ms in-VPC)  │
        └──────────────────┘  └────────────────────────────────┘
```

---

## 5. Key Financial & Operational Takeaways
* **Per-Second Serverless Compute Billing:** Charged strictly for vCPU and memory consumed by active tasks, with zero wasted EC2 cluster headroom.
* **Defense-in-Depth Isolation:** Each Fargate task runs in its own dedicated kernel and Elastic Network Interface (ENI), preventing noisy-neighbor or container-escape risks in regulated financial environments.
* **Deterministic Production Parity:** Because the exact immutable OCI image from ECR runs on Fargate, issues like local OS file-locking or Node version drift are completely eliminated.
