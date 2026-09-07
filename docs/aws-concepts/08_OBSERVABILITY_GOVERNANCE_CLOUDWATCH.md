# AWS Concept: Observability, Telemetry & Model Governance (Amazon CloudWatch)

## 1. Concept Definition
**Cloud Observability** provides deep operational insight into modern distributed systems across three pillars: **Metrics**, **Logs**, and **Traces**. **Amazon CloudWatch** acts as the central monitoring and telemetry hub, collecting real-time operational data, providing queryable log analysis, alerting on threshold violations, and rendering operational dashboards.

---

## 2. Why CloudWatch Was Chosen for Aegis Risk
In banking and institutional insurance risk, model deployment is not the end of the lifecycle. Under **Federal Reserve SR 11-7 (Guidance on Model Risk Management)** and the **OCC (Office of the Comptroller of the Currency)**, financial institutions are legally mandated to maintain:
1. **Immutable Audit Trails:** A tamper-resistant log of every credit scoring decision, underwriter override, and timestamp.
2. **Ongoing Model Performance Monitoring:** Real-time tracking to detect when changes in consumer behavior or macroeconomic conditions cause the model's accuracy to degrade (data drift and concept drift).
3. **Operational Health Monitoring:** Immediate alarms if inference latency spikes or error rates climb during peak trading or application hours.

---

## 3. How These Resources Were Created (Step-by-Step & AWS CLI)

### Step 1: Create Dedicated Audit Log Group
```bash
aws logs create-log-group \
  --log-group-name /aegis-risk/audit-trail \
  --region ap-southeast-2
```

### Step 2: Create Dedicated Log Streams for Audit & Model Drift
```bash
# Stream for underwriter decision non-repudiation
aws logs create-log-stream \
  --log-group-name /aegis-risk/audit-trail \
  --log-stream-name underwriter-decisions \
  --region ap-southeast-2

# Stream for model drift telemetry and population stability indices
aws logs create-log-stream \
  --log-group-name /aegis-risk/audit-trail \
  --log-stream-name model-drift-telemetry \
  --region ap-southeast-2
```

### Step 3: Create CloudWatch Model Health Dashboard
A JSON dashboard configuration was authored tracking Lambda invocations, duration, and errors:
```bash
aws cloudwatch put-dashboard \
  --dashboard-name Aegis-Risk-Model-Health \
  --dashboard-body '{
    "widgets": [
      {
        "type": "metric",
        "properties": {
          "metrics": [
            [ "AWS/Lambda", "Invocations", "FunctionName", "aegis-risk-scoring-engine" ],
            [ ".", "Duration", ".", "." ],
            [ ".", "Errors", ".", "." ]
          ],
          "period": 300,
          "stat": "Average",
          "region": "ap-southeast-2",
          "title": "Lambda Scoring Engine Health"
        }
      }
    ]
  }' \
  --region ap-southeast-2
```

### Step 4: Configure Metric Alarm for Error Spikes
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name Aegis-Scoring-Error-Alarm \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --dimensions Name=FunctionName,Value=aegis-risk-scoring-engine \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:ap-southeast-2:022671037337:aegis-risk-critical-alerts \
  --region ap-southeast-2
```

---

## 4. Integration in Aegis Risk
* **Log Group:** `/aegis-risk/audit-trail`
* **Dashboard Name:** `Aegis-Risk-Model-Health`
* **Region:** `ap-southeast-2`
* **Application Module:** [`lib/aws/cloudwatch.ts`](file:///d:/Java-%20Backend/Project/Mass%20Mutual/ai-powered-loan-default-prediction-system/lib/aws/cloudwatch.ts)
* **Configured In:** [`.env`](file:///d:/Java-%20Backend/Project/Mass%20Mutual/ai-powered-loan-default-prediction-system/.env) under `AWS_CLOUDWATCH_LOG_GROUP` & `AWS_CLOUDWATCH_ENABLED`

#### Specialized Telemetry Streams:
| Log Stream Name | Telemetry Payload | Purpose |
| :--- | :--- | :--- |
| `underwriter-decisions` | JSON event with Borrower ID, Underwriter ID, Model Score, Decision (`APPROVED`/`DECLINED`), and Override Reason | Legal non-repudiation audit trail for regulatory examinations |
| `model-drift-telemetry` | Population Stability Index (PSI), Wasserstein Distance, feature distribution shifts, and AUC degradation metrics | Automated continuous validation against demographic baseline |

---

## 5. Key Financial & Operational Takeaways
* **Satisfies SR 11-7 Compliance:** Provides the exact quantitative evidence demanded by external model auditors and bank examiners.
* **Proactive Risk Containment:** Rather than discovering model drift months later during an annual portfolio review, CloudWatch telemetry detects behavioral shifts in near real-time.
