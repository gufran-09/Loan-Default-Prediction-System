# AWS Concept: Workflow Orchestration & State Machines (AWS Step Functions)

## 1. Concept Definition
**Workflow Orchestration** coordinates distributed services, microservices, and human tasks into structured, fault-tolerant execution sequences. **AWS Step Functions** uses visual JSON/YAML-based finite-state machines (Amazon States Language) to manage state transitions, conditional branching, retries, and error handling without writing fragile orchestration code.

---

## 2. Why Step Functions Was Chosen for Aegis Risk
In commercial lending and life insurance underwriting, loan approvals are never single-step functions. They require **Straight-Through Processing (STP)**:
* High-confidence, low-risk applicants must be **auto-approved** within seconds to minimize customer friction.
* Borderline or high-exposure loans must be routed to senior credit committees for **manual underwriter review**.
* Denied loans must legally trigger automated compliance procedures (such as **CFPB Adverse Action Notices**).

Hardcoding these branching logic chains inside web handlers leads to unmaintainable "spaghetti code." Step Functions decouples the **business policy rules** from the **application code**.

---

## 3. How This Resource Was Created (Step-by-Step & AWS CLI)

The `Aegis-Risk-Credit-Decisioning` state machine was provisioned via the AWS CLI using Amazon States Language (ASL):

### Step 1: Create IAM Execution Role for Step Functions
A role was created granting Step Functions permission to invoke Lambda and publish to SNS:
```bash
aws iam create-role \
  --role-name stepfunctions-aegis-risk-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "states.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'
```
An inline policy was attached granting permissions to call the scoring Lambda and dispatch SNS alerts:
```bash
aws iam put-role-policy \
  --role-name stepfunctions-aegis-risk-role \
  --policy-name StepFunctionsExecutionPolicy \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": ["lambda:InvokeFunction"],
        "Resource": ["arn:aws:lambda:ap-southeast-2:022671037337:function:aegis-risk-scoring-engine"]
      },
      {
        "Effect": "Allow",
        "Action": ["sns:Publish"],
        "Resource": ["arn:aws:sns:ap-southeast-2:022671037337:aegis-risk-critical-alerts"]
      }
    ]
  }'
```

### Step 2: Define the State Machine in ASL (`credit_decisioning.asl.json`)
The conditional evaluation rules were authored in JSON:
```json
{
  "Comment": "Aegis Risk STP Credit Decisioning Pipeline",
  "StartAt": "EvaluateCreditRisk",
  "States": {
    "EvaluateCreditRisk": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:ap-southeast-2:022671037337:function:aegis-risk-scoring-engine",
      "Next": "RiskScoreThreshold"
    },
    "RiskScoreThreshold": {
      "Type": "Choice",
      "Choices": [
        {
          "Variable": "$.default_probability",
          "NumericLessThan": 0.30,
          "Next": "AutoApproveLoan"
        },
        {
          "Variable": "$.default_probability",
          "NumericGreaterThanEquals": 0.70,
          "Next": "AutoDeclineLoan"
        }
      ],
      "Default": "ReferToUnderwriter"
    },
    "AutoApproveLoan": { "Type": "Pass", "Result": { "decision": "APPROVED" }, "End": true },
    "ReferToUnderwriter": { "Type": "Pass", "Result": { "decision": "MANUAL_REVIEW" }, "End": true },
    "AutoDeclineLoan": { "Type": "Pass", "Result": { "decision": "DECLINED" }, "End": true }
  }
}
```

### Step 3: Deploy via AWS CLI
```bash
aws stepfunctions create-state-machine \
  --name Aegis-Risk-Credit-Decisioning \
  --definition file://credit_decisioning.asl.json \
  --role-arn arn:aws:iam::022671037337:role/stepfunctions-aegis-risk-role \
  --type STANDARD \
  --region ap-southeast-2
```
*Generated ARN:* `arn:aws:states:ap-southeast-2:022671037337:stateMachine:Aegis-Risk-Credit-Decisioning`

---

## 4. Integration in Aegis Risk
* **State Machine Name:** `Aegis-Risk-Credit-Decisioning`
* **ARN:** `arn:aws:states:ap-southeast-2:022671037337:stateMachine:Aegis-Risk-Credit-Decisioning`
* **Configured In:** [`.env`](file:///d:/Java-%20Backend/Project/Mass%20Mutual/ai-powered-loan-default-prediction-system/.env) under `AWS_STEP_FUNCTIONS_DECISIONING_ARN`

### Visual State Machine Flow:
```
                     [ Start Execution ]
                              │
                              ▼
                     [ Task: ScoreApplicant ]
                   (Invokes Lambda ML Engine)
                              │
                              ▼
                     [ Choice: EvaluateRisk ]
              ┌───────────────┼───────────────┐
              │ (PD < 0.30)   │(0.30<=PD<0.70)│ (PD >= 0.70)
              ▼               ▼               ▼
      [ State: AutoApprove ] [ State: ReferTo ]  [ State: AutoDecline ]
      - Fast-Track Terms     [ Underwriter  ]    - Trigger CFPB Notice
      - Publish SQS Queue    - Freeze Clock      - Lock Application
              │               │               │
              └───────────────┼───────────────┘
                              ▼
                   [ Task: DispatchNotification ]
                   - Meta WhatsApp Decision Notice
                   - CloudWatch Audit Stream Write
                              │
                              ▼
                         [ Success ]
```

---

## 5. Key Financial & Operational Takeaways
* **Auditability for Regulators:** Under Federal Reserve SR 11-7, bank examiners can visually inspect the execution history of any past loan decision to verify why an applicant took a specific approval or denial path.
* **Deterministic Execution:** Automatic retry mechanisms with exponential backoff prevent partial workflow failures when calling external endpoints like notification gateways.
