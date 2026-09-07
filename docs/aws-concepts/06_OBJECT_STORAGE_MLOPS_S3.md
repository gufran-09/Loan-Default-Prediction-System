# AWS Concept: Object Storage & MLOps Model Registry (Amazon S3)

## 1. Concept Definition
**Cloud Object Storage** stores unstructured and semi-structured data as objects within scalable buckets, offering 99.999999999% (11 9s) of data durability. **Amazon Simple Storage Service (S3)** supports object versioning, access logging, lifecycle policies, and server-side encryption. In modern MLOps architectures, S3 serves as the **Model Lake and Feature Store Registry**.

---

## 2. Why Amazon S3 Was Chosen for Aegis Risk
In regulated credit risk under **Federal Reserve SR 11-7**, financial institutions cannot treat machine learning models as ephemeral files on local hard drives. Regulators mandate:
* **Model Reproducibility:** Every historical score must be reproducible by loading the exact serialized model binary and preprocessing artifacts used at that specific point in time.
* **Immutability:** Model weights and scaler transformations must be protected against accidental deletion or unauthorized tampering.
* **Separation of Concerns:** Model training (Python data science) is physically decoupled from web application runtime (Next.js / Node.js).

---

## 3. How This Resource Was Created (Step-by-Step & AWS CLI)

The S3 Model Lake and versioned directory tree was provisioned via the AWS CLI and populated using the repository’s automated synchronization script:

### Step 1: Create the S3 Bucket
```bash
aws s3 mb s3://aegis-risk-storage-022671037337 --region ap-southeast-2
```

### Step 2: Enable Bucket Versioning & Server-Side Encryption
To protect model weights against accidental overwrites and comply with financial data encryption rules:
```bash
# Enable Versioning
aws s3api put-bucket-versioning \
  --bucket aegis-risk-storage-022671037337 \
  --versioning-configuration Status=Enabled

# Enforce Server-Side Encryption (AES-256)
aws s3api put-bucket-encryption \
  --bucket aegis-risk-storage-022671037337 \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'
```

### Step 3: Synchronize Production Model Artifacts
Using the project sync script [`scripts/aws_s3_sync.py`](file:///d:/Java-%20Backend/Project/Mass%20Mutual/ai-powered-loan-default-prediction-system/scripts/aws_s3_sync.py):
```bash
python scripts/aws_s3_sync.py
```
Or directly via AWS CLI:
```bash
aws s3 sync artifacts/ s3://aegis-risk-storage-022671037337/models/v1/ --region ap-southeast-2
```
*Verification:*
```bash
aws s3 ls s3://aegis-risk-storage-022671037337/models/v1/ --recursive
```

---

## 4. Integration in Aegis Risk
* **Bucket Name:** `s3://aegis-risk-storage-022671037337`
* **Region:** `ap-southeast-2` (Sydney)
* **Configured In:** [`.env`](file:///d:/Java-%20Backend/Project/Mass%20Mutual/ai-powered-loan-default-prediction-system/.env) under `AWS_S3_BUCKET_NAME`

### Verified Model Artifacts Stored:
| Object Key | Type | Description |
| :--- | :--- | :--- |
| `models/v1/xgboost_loan_default.json` | Model Binary | Calibrated XGBoost gradient-boosted classifier (`scale_pos_weight = 7.61`) |
| `models/v1/preprocessor.joblib` | Scikit-learn Pipeline | Numerical scaler and categorical one-hot encoder definitions |
| `models/v1/feature_names.json` | Feature Manifest | Canonical order and types of the 31 input features |
| `models/v1/demographic_baseline.json` | Telemetry Baseline | Reference distributions across demographic slices for drift tracking |
| `models/v1/training_metadata.json` | MLOps Audit Trail | Hyperparameters, AUC (0.7576), train/test split hashes, and training timestamp |

---

## 5. Key Financial & Operational Takeaways
* **Compliance Audit Trail:** Bank examiners can verify the cryptographic hash of the model running in production against the validated model documented in internal audit reports.
* **Zero-Downtime Hot-Swapping:** When a new model candidate is promoted (`models/v2`), backend scoring Lambdas can reload the binary from S3 without redeploying application code.
