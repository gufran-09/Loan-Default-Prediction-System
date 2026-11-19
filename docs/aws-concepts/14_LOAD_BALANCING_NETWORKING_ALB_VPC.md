# AWS Concept: Layer-7 Load Balancing & Network Security (Elastic Load Balancing ALB & Amazon VPC)

## 1. Concept Definition
**Elastic Load Balancing — Application Load Balancer (ALB)** is a managed Layer-7 (HTTP/HTTPS) load balancer that distributes incoming application traffic across multiple Availability Zones and containerized targets, performing continuous health checks and zero-downtime target draining. **Amazon Virtual Private Cloud (VPC)** provides the isolated software-defined network fabric—comprising subnets, route tables, and stateful **Security Groups**—that governs exactly which network paths can reach the load balancer, compute containers, and relational database.

---

## 2. Why ALB & VPC Security Groups Were Chosen for Aegis Risk
Exposing a container's ephemeral IP address directly to underwriters is fragile and insecure:
* **Stable Public Entrypoint:** Fargate tasks receive new ENI IP addresses on every deployment or self-healing restart. The ALB provides a permanent DNS endpoint (`aegis-risk-alb-362464102.ap-southeast-2.elb.amazonaws.com`) listening on standard HTTP port `80` and forwarding internally to container port `3000`.
* **Application-Aware Health Probing:** Rather than checking only TCP port liveness, the ALB Target Group actively polls `GET /api/health` every 15 seconds, validating both **Amazon RDS PostgreSQL connectivity** and **ML model artifact (`ml/model.json`) integrity** before routing live user traffic to a task.
* **Multi-AZ High Availability:** Deployed across two distinct Sydney Availability Zones (`ap-southeast-2a` and `ap-southeast-2b`) to protect against single-zone network or compute disruptions.
* **Layered Network Isolation (Security Groups):** Enforces stateful firewall boundaries separating public ingress (`aegis-risk-alb-sg`), application runtime containers (`aegis-risk-ecs-sg`), and the PostgreSQL persistence tier (`sg-05627a1c87259dcf5`).
* **HTTPS-Ready Termination:** Supports seamless attachment of an AWS Certificate Manager (ACM) TLS certificate on port `443` without modifying the Next.js container—and automatically passes `X-Forwarded-Proto` headers that Aegis Risk's [`lib/auth/session.ts`](file:///d:/PROJECTS/MASS_MUTUAL/Loan-Default-Prediction-System/lib/auth/session.ts) inspects for dynamic cookie security.

---

## 3. How These Resources Were Created (Step-by-Step & AWS CLI)

### Step 1: Identify VPC & Multi-AZ Subnets
* **VPC ID:** `vpc-01741ac3f53544659` (`172.31.0.0/16`)
* **Public Subnets:**
  * `subnet-065ca276963711132` (`ap-southeast-2a`)
  * `subnet-038b55a3e484c9247` (`ap-southeast-2b`)
  * `subnet-06e48a47b607f537d` (`ap-southeast-2c`)

### Step 2: Create Stateful Security Groups
```bash
# 1. ALB Security Group (Public HTTP Port 80)
aws ec2 create-security-group \
  --group-name aegis-risk-alb-sg \
  --description "Security group for Aegis Risk ALB" \
  --vpc-id vpc-01741ac3f53544659 \
  --region ap-southeast-2

aws ec2 authorize-security-group-ingress \
  --group-id sg-05ce68f6cd15f2465 \
  --protocol tcp --port 80 --cidr 0.0.0.0/0 \
  --region ap-southeast-2

# 2. ECS Fargate Task Security Group (Port 3000 from ALB)
aws ec2 create-security-group \
  --group-name aegis-risk-ecs-sg \
  --description "Security group for Aegis Risk ECS Fargate tasks" \
  --vpc-id vpc-01741ac3f53544659 \
  --region ap-southeast-2

aws ec2 authorize-security-group-ingress \
  --group-id sg-0b4fcc9c3c0928028 \
  --protocol tcp --port 3000 --source-group sg-05ce68f6cd15f2465 \
  --region ap-southeast-2
```

### Step 3: Create the IP-Mode Target Group with Deep Health Checks
*(Fargate uses `awsvpc` networking, requiring `--target-type ip`.)*
```bash
aws elbv2 create-target-group \
  --name aegis-risk-tg \
  --protocol HTTP \
  --port 3000 \
  --target-type ip \
  --vpc-id vpc-01741ac3f53544659 \
  --health-check-path /api/health \
  --health-check-interval-seconds 15 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 5 \
  --region ap-southeast-2
```
*Target Group ARN:* `arn:aws:elasticloadbalancing:ap-southeast-2:022671037337:targetgroup/aegis-risk-tg/b0981e52a86017eb`

### Step 4: Provision the Internet-Facing Application Load Balancer & Listener
```bash
aws elbv2 create-load-balancer \
  --name aegis-risk-alb \
  --subnets subnet-065ca276963711132 subnet-038b55a3e484c9247 \
  --security-groups sg-05ce68f6cd15f2465 \
  --scheme internet-facing \
  --type application \
  --region ap-southeast-2

aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:ap-southeast-2:022671037337:loadbalancer/app/aegis-risk-alb/7623bb887f4fb74d \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:ap-southeast-2:022671037337:targetgroup/aegis-risk-tg/b0981e52a86017eb \
  --region ap-southeast-2
```

### Step 5: Verify Target Registration & Health
```bash
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:ap-southeast-2:022671037337:targetgroup/aegis-risk-tg/b0981e52a86017eb \
  --region ap-southeast-2
```

---

## 4. Integration in Aegis Risk
* **ALB Name:** `aegis-risk-alb`
* **Public DNS:** `http://aegis-risk-alb-362464102.ap-southeast-2.elb.amazonaws.com`
* **VPC:** `vpc-01741ac3f53544659` (`ap-southeast-2`)
* **Security Groups:**
  * ALB Ingress: `sg-05ce68f6cd15f2465` (`aegis-risk-alb-sg`, TCP `80`)
  * ECS Runtime: `sg-0b4fcc9c3c0928028` (`aegis-risk-ecs-sg`, TCP `3000`)
  * RDS Database: `sg-05627a1c87259dcf5` (TCP `5432`)
* **Health Check Route:** [`app/api/health/route.ts`](file:///d:/PROJECTS/MASS_MUTUAL/Loan-Default-Prediction-System/app/api/health/route.ts)
* **Forwarded-Proto Cookie Logic:** [`lib/auth/session.ts`](file:///d:/PROJECTS/MASS_MUTUAL/Loan-Default-Prediction-System/lib/auth/session.ts)

### Multi-AZ Traffic & Security Group Topology:
```
                      [ Public Internet / Underwriters ]
                                      │
                             HTTP :80 │ (sg-05ce68f6cd15f2465)
                                      ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │                 VPC: vpc-01741ac3f53544659 (172.31.0.0/16)          │
  │                                                                     │
  │   [ Application Load Balancer: aegis-risk-alb ]                     │
  │   (Spanning ap-southeast-2a & ap-southeast-2b)                      │
  │                         │                                           │
  │                         │ Listener :80 -> Target Group aegis-risk-tg│
  │                         │ Health Probe: GET /api/health (every 15s) │
  │                         ▼ (sg-0b4fcc9c3c0928028, TCP :3000)         │
  │   [ ECS Fargate Task ENI (Next.js 16 Standalone Server) ]           │
  │                         │                                           │
  │                         ▼ (sg-05627a1c87259dcf5, TCP :5432, 4ms)    │
  │   [ Amazon RDS PostgreSQL 16: aegis-risk-db ]                       │
  └─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Key Financial & Operational Takeaways
* **Zero-Downtime Releases:** Combined with ECS rolling deployments, the ALB drains active underwriter connections gracefully while verifying new container health before shifting traffic.
* **Resilience Against Partial Failures:** Deep `/api/health` checks ensure an instance with a broken DB connection or missing ML artifact is automatically taken out of rotation before returning HTTP 500 errors to risk officers.
* **Enterprise Upgrade Path:** Adding a custom domain via **Amazon Route 53**, TLS 1.3 via **AWS Certificate Manager (ACM)**, and Layer-7 DDoS/SQLi filtering via **AWS WAF** attaches directly to this ALB with zero changes to application code.
