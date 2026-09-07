# AWS Concept: Event-Driven Push Messaging & Pub/Sub (Amazon SNS)

## 1. Concept Definition
**Publish/Subscribe (Pub/Sub)** is an asynchronous communication pattern where message senders (publishers) decouple from message receivers (subscribers). **Amazon Simple Notification Service (SNS)** is a fully managed Pub/Sub service that distributes high-throughput, fan-out messages to multiple endpoints simultaneously, including Amazon SQS queues, AWS Lambda functions, HTTPS webhooks, email addresses, and mobile SMS.

---

## 2. Why Amazon SNS Was Chosen for Aegis Risk
In portfolio risk management, certain events cannot wait for someone to refresh a dashboard:
* **Severe Macroeconomic Shocks:** When an automated stress test indicates a sudden surge in Expected Loss ($EL$).
* **Rapid Borrower Deterioration:** When a high-exposure borrower's Debt-to-Income (DTI) crosses a critical threshold or triggers multi-delinquency status.
* **System-Level Anomalies:** When scoring models cross degradation thresholds.

Synchronous API calls would lock the user interface. SNS allows the application to publish a single event and instantly return to the user, while SNS asynchronously fans out notifications to on-call credit risk supervisors and compliance personnel.

---

## 3. How This Resource Was Created (Step-by-Step & AWS CLI)

### Step 1: Create the SNS Topic
```bash
aws sns create-topic \
  --name aegis-risk-critical-alerts \
  --region ap-southeast-2
```
*Generated Topic ARN:* `arn:aws:sns:ap-southeast-2:022671037337:aegis-risk-critical-alerts`

### Step 2: Configure Subscriptions (Email & SQS Fan-Out)
To ensure critical alerts immediately notify the risk engineering team:
```bash
# Subscribe Email Endpoint for Risk Supervisors
aws sns subscribe \
  --topic-arn arn:aws:sns:ap-southeast-2:022671037337:aegis-risk-critical-alerts \
  --protocol email \
  --notification-endpoint "risk-committee@massmutual-demo.internal" \
  --region ap-southeast-2
```

### Step 3: Grant IAM Permissions to Application User
An IAM policy was created allowing the Next.js API route to publish to the specific SNS topic ARN:
```bash
aws iam put-user-policy \
  --user-name aegis-risk-app-user \
  --policy-name SNSPublishPolicy \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["sns:Publish"],
      "Resource": "arn:aws:sns:ap-southeast-2:022671037337:aegis-risk-critical-alerts"
    }]
  }'
```

---

## 4. Integration in Aegis Risk
* **Topic Name:** `aegis-risk-critical-alerts`
* **Topic ARN:** `arn:aws:sns:ap-southeast-2:022671037337:aegis-risk-critical-alerts`
* **Region:** `ap-southeast-2`
* **Application Module:** [`lib/aws/sns.ts`](file:///d:/Java-%20Backend/Project/Mass%20Mutual/ai-powered-loan-default-prediction-system/lib/aws/sns.ts)
* **Configured In:** [`.env`](file:///d:/Java-%20Backend/Project/Mass%20Mutual/ai-powered-loan-default-prediction-system/.env) under `AWS_SNS_TOPIC_ARN`

### Pub/Sub Event Fan-Out Architecture:
```
                      [ Critical Risk Event Triggered ]
                      (e.g., Extreme High-DTI / High Default Risk)
                                     │
                                     ▼
                      [ Amazon SNS Topic: critical-alerts ]
                                     │
                 ┌───────────────────┼───────────────────┐
                 ▼                   ▼                   ▼
         [ Email / PagerDuty ] [ AWS Lambda ]     [ Amazon SQS Queue ]
         Risk Committee Paged  Escalation Handler High-Priority Audit Queue
```

---

## 5. Key Financial & Operational Takeaways
* **Sub-Second Incident Response:** Ensures zero latency between a credit risk threshold breach and senior management notification.
* **Loose Coupling:** New subscribers (such as automated compliance archiving or third-party webhooks) can be attached to the topic without changing a single line of application source code.
