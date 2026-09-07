# AWS Concept: Identity, Authentication & Least Privilege (AWS Cognito & IAM)

## 1. Concept Definition
Cloud security relies on two distinct identity layers:
1. **Customer & Enterprise Identity (CIAM - AWS Cognito):** Manages end-user identity directories, sign-in, multi-factor authentication (MFA), and JSON Web Token (JWT) federation.
2. **Infrastructure & Machine Identity (AWS IAM):** Manages access controls, roles, and fine-grained permissions for cloud services and compute workloads based on the **Principle of Least Privilege (PoLP)**.

---

## 2. Why Cognito & IAM Were Chosen for Aegis Risk
In an institutional lending cockpit:
* **Separation of Duties:** Junior analysts cannot approve multi-million-dollar credit facilities. Model auditors need read-only access, while senior underwriters require override capabilities.
* **Token-Based Security:** Instead of storing plaintext passwords or fragile session states in server memory, AWS Cognito issues standards-compliant JWT tokens (`id_token`, `access_token`).
* **Zero Hardcoded Secrets:** AWS Lambda, Step Functions, and API Gateway communicate using temporary IAM role credentials (STS) rather than dangerous static AWS access keys.

---

## 3. How These Resources Were Created (Step-by-Step & AWS CLI)

### Step 1: Create the Cognito User Pool
```bash
aws cognito-idp create-user-pool \
  --pool-name aegis-risk-underwriters \
  --auto-verified-attributes email \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 8,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": false
    }
  }' \
  --schema '[
    {"Name": "email", "AttributeDataType": "String", "Required": true, "Mutable": true},
    {"Name": "name", "AttributeDataType": "String", "Required": true, "Mutable": true},
    {"Name": "role", "AttributeDataType": "String", "Required": false, "Mutable": true}
  ]' \
  --region ap-southeast-2
```
*Generated User Pool ID:* `ap-southeast-2_80G23Am1X`

### Step 2: Create App Client for Single Page App (SPA)
Because Next.js runs in modern browsers, a public app client without a client secret was created:
```bash
aws cognito-idp create-user-pool-client \
  --user-pool-id ap-southeast-2_80G23Am1X \
  --client-name aegis-risk-web-client \
  --no-generate-secret \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --prevent-user-existence-errors ENABLED \
  --region ap-southeast-2
```
*Generated Client ID:* `74120ugqosjjpmup4utltl1oqf`

### Step 3: Create User Groups for Role-Based Access Control (RBAC)
```bash
aws cognito-idp create-group \
  --group-name SeniorUnderwriter \
  --user-pool-id ap-southeast-2_80G23Am1X \
  --description "Authorized to approve loans and execute What-If restructuring"

aws cognito-idp create-group \
  --group-name RiskOfficer \
  --user-pool-id ap-southeast-2_80G23Am1X \
  --description "Authorized to acknowledge alerts and review model drift"
```

---

## 4. Integration in Aegis Risk
* **User Pool ID:** `ap-southeast-2_80G23Am1X`
* **App Client ID:** `74120ugqosjjpmup4utltl1oqf`
* **Region:** `ap-southeast-2`
* **Configured In:** [`.env`](file:///d:/Java-%20Backend/Project/Mass%20Mutual/ai-powered-loan-default-prediction-system/.env) under:
  - `NEXT_PUBLIC_AWS_COGNITO_USER_POOL_ID`
  - `NEXT_PUBLIC_AWS_COGNITO_CLIENT_ID`

#### Role-Based Access Hierarchy:
```
               [ AWS Cognito User Pool ]
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   [ Role: Underwriter ] [ Role: RiskOfficer ] [ Role: ModelAuditor ]
   - Score Applicants    - Acknowledge Alerts  - Read-Only Drift Logs
   - Restructure Loans   - Override Decisions  - Export Fair Lending Reports
   - Trigger Bedrock Memo- Publish SNS Alerts  - View S3 Model Registry
```

---

## 5. Key Financial & Operational Takeaways
* **OCC & SOC-2 Compliance:** Eliminates shared credentials; every credit action is tied to an authenticated underwriter email in the Cognito directory.
* **Secure Token Lifecycle:** Refresh tokens allow seamless underwriter sessions while short-lived access tokens (1 hour) mitigate credential theft.
