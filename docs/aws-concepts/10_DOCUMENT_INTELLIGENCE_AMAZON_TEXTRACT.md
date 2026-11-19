# AWS Concept: Document Intelligence & OCR (Amazon Textract)

## 1. Concept Definition
**Amazon Textract** is a fully managed Machine Learning (ML) service that automatically extracts printed text, handwriting, structured tables, and form key-value pairs from scanned documents and PDFs. Unlike legacy Optical Character Recognition (OCR) tools that rely on brittle template coordinates, Textract uses deep learning models to understand document layouts and return structured `Block` hierarchies (`PAGE`, `LINE`, `WORD`) along with per-element confidence scores.

---

## 2. Why Amazon Textract Was Chosen for Aegis Risk
Income verification is one of the highest-friction bottlenecks in consumer loan underwriting and a prime vector for application fraud:
* **Automated Payslip & Tax Parsing:** Underwriters traditionally spend 10–15 minutes manually reading uploaded pay stubs, W-2s, or bank statements to cross-check stated income. Textract extracts line-by-line text in under a second.
* **DTI Ratio Validation:** By automatically extracting gross/net monthly pay figures and comparing them against borrower-declared income, Aegis Risk prevents understated Debt-to-Income (DTI) ratios from slipping through automated scoring.
* **Zero ML Infrastructure Overhead:** Eliminates the need to train, host, or patch custom computer-vision OCR pipelines (such as Tesseract or GPU-backed layout models).
* **Confidence-Gated Fallbacks:** Every extracted field carries a confidence metric (`confidenceScore`), allowing the underwriting workflow to gracefully fall back to manual review when document scans are illegible or degraded.

---

## 3. How This Resource Was Configured (Step-by-Step & AWS CLI)

Amazon Textract is a serverless, API-driven service that requires no upfront cluster provisioning. Integration requires only IAM permissions and the AWS SDK v3 client.

### Step 1: Install the AWS SDK v3 Textract Client
```bash
npm install @aws-sdk/client-textract
```

### Step 2: Grant Least-Privilege IAM Permissions to the ECS Task Role
The runtime application role (`aegis-risk-ecs-task-role`) is granted permission to invoke Textract document analysis APIs in `ap-southeast-2`:
```bash
aws iam put-role-policy \
  --role-name aegis-risk-ecs-task-role \
  --policy-name aegis-risk-runtime-aws-access \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": [
        "textract:DetectDocumentText",
        "textract:AnalyzeDocument"
      ],
      "Resource": "*"
    }]
  }'
```

### Step 3: Verify Textract API Availability in Region
```bash
aws textract detect-document-text \
  --document '{"S3Object":{"Bucket":"aegis-risk-storage-022671037337","Name":"samples/payslip.png"}}' \
  --region ap-southeast-2
```

---

## 4. Integration in Aegis Risk
* **Region:** `ap-southeast-2`
* **SDK Package:** `@aws-sdk/client-textract` (`DetectDocumentTextCommand`)
* **Application Module:** [`lib/aws/textract.ts`](file:///d:/PROJECTS/MASS_MUTUAL/Loan-Default-Prediction-System/lib/aws/textract.ts)
* **Exported Interface:** `parseBorrowerIncomeDocument(documentBytes: Uint8Array): Promise<ExtractedIncomeData>`

### How the Extraction Pipeline Works:
1. Raw document bytes (`Uint8Array`) from an uploaded payslip or tax document are sent to `DetectDocumentTextCommand`.
2. Textract returns `Blocks`, which Aegis Risk filters for `BlockType === 'LINE'`.
3. Domain-specific financial regex rules extract gross, net, monthly, or salary amounts (bounded between `\$500` and `\$500,000` to suppress noise such as dates or account numbers).
4. Returns `{ monthlyIncome, confidenceScore, rawTextSnippets }`, or safely degrades to `{ monthlyIncome: undefined, confidenceScore: 0 }` on service error so underwriting never crashes.

### Document Intelligence Flow:
```
           [ Borrower Payslip / Tax Statement (PNG/PDF/JPG) ]
                                   │
                                   ▼
                 [ Next.js API Route (Uint8Array Bytes) ]
                                   │
                                   ▼
                [ Amazon Textract: DetectDocumentText ]
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
           [ LINE Blocks Extracted ]      [ Error / Low Quality ]
                    │                             │
                    ▼                             ▼
        [ Financial Regex Parser ]       [ Graceful Fallback:
        (Gross/Net/Monthly Salary)        Manual Underwriter Review ]
                    │
                    ▼
       [ Verified Income -> DTI Recalculation & Credit Scoring ]
```

---

## 5. Key Financial & Operational Takeaways
* **Pay-Per-Page Economics:** Billed strictly per page analyzed with zero idle server costs—ideal for bursty loan origination periods.
* **Fraud & Misrepresentation Mitigation:** Provides an objective, auditable machine-read income verification layer directly inside the underwriting workflow.
* **Security & Privacy:** Document bytes are transmitted over TLS via the IAM task role without storing unencrypted long-term AWS credentials in source code.
