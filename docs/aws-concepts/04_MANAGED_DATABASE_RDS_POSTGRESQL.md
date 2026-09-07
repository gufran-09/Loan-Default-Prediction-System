# AWS Concept: Managed Relational Persistence (Amazon RDS PostgreSQL 16)

## 1. Concept Definition
**Database-as-a-Service (DBaaS)** provides fully managed relational database instances. **Amazon Relational Database Service (RDS)** automates time-consuming administrative tasks, including hardware provisioning, database setup, automated patch management, continuous backups, point-in-time recovery (PITR), and Multi-Availability Zone (Multi-AZ) high availability.

---

## 2. Why Amazon RDS Was Chosen for Aegis Risk
Financial credit platforms require strict **ACID guarantees** (Atomicity, Consistency, Isolation, Durability) and relational data integrity:
* **Relational Schemas:** Borrowers, credit scores, SHAP explanations, and audit alerts are fundamentally relational entities connected via primary and foreign key constraints.
* **OCC & Fed Compliance:** Financial regulators mandate that credit decisions and historical risk scores remain durable, tamper-resistant, and queryable with transactional isolation.
* **Enterprise Reliability:** Unlike local SQLite or developer sandbox databases, Amazon RDS provides automated snapshots, read replicas for high-throughput reporting, and enterprise encryption at rest via AWS KMS.

---

## 3. How This Resource Was Created (Step-by-Step & AWS CLI)

The `aegis-risk-db` PostgreSQL 16 instance was provisioned, configured, and populated using the AWS CLI and automated Python seeding scripts:

### Step 1: Create a Dedicated Security Group
A VPC security group was created to permit secure inbound PostgreSQL traffic on port 5432:
```bash
# Create Security Group
aws ec2 create-security-group \
  --group-name aegis-rds-sg \
  --description "Security group for Aegis Risk RDS PostgreSQL" \
  --region ap-southeast-2
# Output: sg-05627a1c87259dcf5

# Authorize inbound Port 5432
aws ec2 authorize-security-group-ingress \
  --group-id sg-05627a1c87259dcf5 \
  --protocol tcp \
  --port 5432 \
  --cidr 0.0.0.0/0 \
  --region ap-southeast-2
```

### Step 2: Provision the Amazon RDS PostgreSQL Instance
Using the ARM-based Graviton2 processor (`db.t4g.micro`) for maximum cost and energy efficiency:
```bash
aws rds create-db-instance \
  --db-instance-identifier aegis-risk-db \
  --db-instance-class db.t4g.micro \
  --engine postgres \
  --engine-version 16.9 \
  --master-username postgres \
  --master-user-password "YourSecureMasterPassword" \
  --allocated-storage 20 \
  --storage-type gp3 \
  --vpc-security-group-ids sg-05627a1c87259dcf5 \
  --publicly-accessible \
  --no-multi-az \
  --backup-retention-period 7 \
  --region ap-southeast-2
```
*Generated Endpoint:* `aegis-risk-db.c1wu2mekybkk.ap-southeast-2.rds.amazonaws.com:5432`

### Step 3: Run DDL Migrations & Seed Institutional Portfolio
Because fresh Amazon RDS instances do not include custom schemas or seed data, the project’s migration script was executed:
```bash
# Execute institutional portfolio migration & seed
python scripts/seed_rds.py
```
*Verified Seeded Row Counts:*
- `borrowers`: 400 records
- `risk_scores`: 400 records
- `alerts`: 93 records
- `risk_reasons`: 1,200 SHAP records

---

## 4. Integration in Aegis Risk
* **Database Engine:** PostgreSQL 16.9
* **Endpoint:** `aegis-risk-db.c1wu2mekybkk.ap-southeast-2.rds.amazonaws.com:5432`
* **Database Name:** `postgres`
* **Connection Pooling:** Connected via `pg.Pool` in [`lib/db/postgres.ts`](file:///d:/Java-%20Backend/Project/Mass%20Mutual/ai-powered-loan-default-prediction-system/lib/db/postgres.ts)
* **Connection String:** Configured in [`.env`](file:///d:/Java-%20Backend/Project/Mass%20Mutual/ai-powered-loan-default-prediction-system/.env) under `DATABASE_URL`

### Database Schema Structure:
```
           ┌───────────────────────┐
           │       BORROWERS       │
           │ (400 Seeded Records)  │
           └───────────┬───────────┘
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
┌──────────────┐             ┌──────────────────┐
│    SCORES    │             │   SHAP_REASONS   │
│ (400 Scores) │             │ (1,200 Features) │
└──────┬───────┘             └──────────────────┘
       │
       ▼
┌──────────────┐
│    ALERTS    │
│ (93 Records) │
└──────────────┘
```

---

## 5. Key Financial & Operational Takeaways
* **Data Durability:** Automated snapshots ensure zero data loss in the event of an unexpected disaster or cluster failure.
* **Secure Hybrid Fallback:** The application code is built with resilient connection pooling, allowing instant fallback between Amazon RDS and Supabase without code alterations.
