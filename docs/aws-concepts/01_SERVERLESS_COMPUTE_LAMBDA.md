# AWS Concept: Serverless Compute (AWS Lambda)

## 1. Concept Definition
**Serverless compute** is a cloud execution model where developers run application code in response to events without provisioning, patching, scaling, or managing servers. Compute resources are allocated dynamically, scale automatically from zero to thousands of concurrent requests, and cost nothing when idle.

---

## 2. Why Serverless Was Chosen for Aegis Risk
In traditional loan scoring platforms, running dedicated virtual machines (such as EC2 instances) introduces significant drawbacks:
* **Cost Inefficiency:** Credit applications arrive in bursts (e.g., during business hours or promotional loan campaigns), leaving dedicated servers idle at night and on weekends.
* **Operational Overhead:** Maintaining OS patches, runtime environments, and scaling groups distracts from data science and actuarial risk modeling.
* **Cold Starts vs. Instant Scale:** Serverless functions provide automated elasticity, executing inferences in sub-second timeframes and scaling seamlessly during batch application uploads.

---

## 3. How This Resource Was Created (Step-by-Step & AWS CLI)

The `aegis-risk-scoring-engine` Lambda function was created and deployed using the AWS CLI and IAM execution roles:

### Step 1: Create IAM Execution Role & Trust Policy
A trust policy was created granting AWS Lambda the permission to assume the execution role:
```bash
aws iam create-role \
  --role-name lambda-aegis-scoring-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'
```
The basic execution policy for CloudWatch logging was attached:
```bash
aws iam attach-role-policy \
  --role-name lambda-aegis-scoring-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

### Step 2: Package Python Inference Code
The scoring handler and model dependencies were packaged into a deployment ZIP file:
```bash
cd lambda/
zip -r function.zip scoring_handler.py model.json
```

### Step 3: Create the Lambda Function via AWS CLI
```bash
aws lambda create-function \
  --function-name aegis-risk-scoring-engine \
  --runtime python3.10 \
  --role arn:aws:iam::022671037337:role/lambda-aegis-scoring-role \
  --handler scoring_handler.lambda_handler \
  --zip-file fileb://function.zip \
  --timeout 10 \
  --memory-size 512 \
  --region ap-southeast-2
```

---

## 4. Integration in Aegis Risk
* **Resource Name:** `aegis-risk-scoring-engine`
* **ARN:** `arn:aws:lambda:ap-southeast-2:022671037337:function:aegis-risk-scoring-engine`
* **Runtime:** Python 3.10+ (equipped with numerical inference logic)
* **Application Seam:** [`lib/scoring/getScore.ts`](file:///d:/Java-%20Backend/Project/Mass%20Mutual/ai-powered-loan-default-prediction-system/lib/scoring/getScore.ts)

### How It Works:
1. The underwriter adjusts loan restructuring sliders (amount, tenure, down payment) or submits a new borrower application in the UI.
2. The Next.js frontend dispatches the 31 borrower feature vector to the scoring endpoint.
3. The Lambda function triggers, evaluates the non-linear risk surfaces across the trained decision trees, and computes:
   * **Calibrated Default Probability ($PD$)**: Between `0.000` and `1.000`.
   * **Normalized Credit Rating**: Calibrated on a `300 – 850` institutional scale.
   * **Risk Bucket Assignment**: `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL`.
4. The response returns in under **150 milliseconds**, updating the underwriter cockpit dynamically.

---

## 5. Key Financial & Operational Takeaways
* **Pay-per-Inference:** Instead of paying ~$70–$200/month for continuous EC2 instances, the Lambda function only incurs cost for the exact duration of each score execution.
* **Fault Isolation:** A crash or timeout in an individual scoring invocation does not affect the rest of the web application or database layer.
