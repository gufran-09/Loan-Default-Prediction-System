# AWS Concept: Cloud-Native Build Automation (AWS CodeBuild)

## 1. Concept Definition
**AWS CodeBuild** is a fully managed, serverless continuous integration (CI) build service that compiles source code, runs unit tests, builds Docker container images, and produces deployable software packages in isolated, ephemeral cloud build environments. It scales automatically and charges strictly by the build minute with zero idle build servers to maintain.

---

## 2. Why AWS CodeBuild Was Chosen for Aegis Risk
Building a modern Next.js 16 + Tailwind CSS v4 standalone Docker image locally on developer workstations introduces several operational hazards:
* **Eliminates OS-Specific Build Failures:** Developing on Windows exposes builds to NTFS directory-locking (`EPERM` on `mkdir`), symlink limitations during Next.js standalone tracing, and local Docker Desktop / WSL2 daemon dependencies. CodeBuild compiles natively inside an AWS-managed Linux container (`amazonlinux2-x86_64-standard:5.0`) with privileged Docker-in-Docker support.
* **High-Speed Cloud Registry Pushes:** Rather than uploading hundreds of megabytes of Docker layers over a residential or office internet connection, only a ~388 KB compressed source archive (`source.zip`) is uploaded to S3; CodeBuild builds and pushes all container layers directly to Amazon ECR over AWS's high-bandwidth internal backbone in seconds.
* **Declarative Build-as-Code (`buildspec.yml`):** Every build step—ECR login, `docker build`, tagging, `docker push`, and `imagedefinitions.json` generation—is version-controlled right inside the repository.
* **Full Auditability:** Every build execution streams stdout/stderr automatically to CloudWatch Logs (`/aws/codebuild/aegis-risk-build`) with phase-by-phase timing and exit status tracking.

---

## 3. How This Resource Was Created (Step-by-Step & AWS CLI)

### Step 1: Create the CodeBuild IAM Service Role
```bash
aws iam create-role \
  --role-name aegis-risk-codebuild-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": { "Service": "codebuild.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam put-role-policy \
  --role-name aegis-risk-codebuild-role \
  --policy-name aegis-risk-codebuild-permissions \
  --policy-document file://codebuild-policy.json
```
*(Grants least-privilege access to CloudWatch Logs, `s3://aegis-risk-storage-022671037337/*`, and Amazon ECR push/pull actions.)*

### Step 2: Upload the Linux-Normalized Source Archive to S3
```bash
aws s3 cp source.zip s3://aegis-risk-storage-022671037337/build/source.zip \
  --region ap-southeast-2
```
*(Archive includes `app/`, `components/`, `lib/`, `ml/`, `public/`, `package.json`, `package-lock.json`, `next.config.mjs`, `postcss.config.mjs`, `components.json`, `tsconfig.json`, `proxy.ts`, `Dockerfile`, `.dockerignore`, and `buildspec.yml` with POSIX `/` entry paths.)*

### Step 3: Create the CodeBuild Project (`aegis-risk-build`)
```bash
aws codebuild create-project \
  --cli-input-json file://codebuild-project.json \
  --region ap-southeast-2
```
*Project Specifications:*
* **Project ARN:** `arn:aws:codebuild:ap-southeast-2:022671037337:project/aegis-risk-build`
* **Source:** `S3` -> `aegis-risk-storage-022671037337/build/source.zip`
* **Build Image:** `aws/codebuild/amazonlinux2-x86_64-standard:5.0`
* **Compute Type:** `BUILD_GENERAL1_MEDIUM` (`privilegedMode: true` for Docker daemon)
* **Environment Variables:** `AWS_DEFAULT_REGION=ap-southeast-2`, `AWS_ACCOUNT_ID=022671037337`, `IMAGE_REPO_NAME=aegis-risk`

### Step 4: Trigger & Monitor a Cloud Build
```bash
# Trigger build
aws codebuild start-build \
  --project-name aegis-risk-build \
  --region ap-southeast-2

# Check build phases & status
aws codebuild batch-get-builds \
  --ids <BUILD_ID> \
  --query "builds[0].[currentPhase,buildStatus]" \
  --output text \
  --region ap-southeast-2
```

---

## 4. Integration in Aegis Risk
* **Project Name:** `aegis-risk-build`
* **Service Role:** `arn:aws:iam::022671037337:role/aegis-risk-codebuild-role`
* **Source Bucket Key:** `s3://aegis-risk-storage-022671037337/build/source.zip`
* **Build Specification:** [`buildspec.yml`](file:///d:/PROJECTS/MASS_MUTUAL/Loan-Default-Prediction-System/buildspec.yml)
* **Container Recipe:** [`Dockerfile`](file:///d:/PROJECTS/MASS_MUTUAL/Loan-Default-Prediction-System/Dockerfile)
* **Build Logs:** CloudWatch Log Group `/aws/codebuild/aegis-risk-build`

### Cloud CI/CD Build Pipeline:
```
    [ Developer Workspace ]
              │ (388 KB source.zip)
              ▼
    [ Amazon S3: build/source.zip ]
              │
              ▼
  ┌──────────────────────────────────────────────────────┐
  │          AWS CodeBuild: aegis-risk-build             │
  │  1. PRE_BUILD:  aws ecr get-login-password -> login  │
  │  2. BUILD:      docker build (npm ci + next build +  │
  │                 Tailwind v4 PostCSS + standalone)    │
  │  3. POST_BUILD: docker push -> Amazon ECR :latest    │
  └──────────────────────────┬───────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
    [ Amazon ECR: aegis-risk ]    [ CloudWatch Logs ]
    (Ready for ECS Rollout)       (/aws/codebuild/...)
```

---

## 5. Key Financial & Operational Takeaways
* **Zero Idle CI Cost:** Free tier covers 100 build minutes/month on `BUILD_GENERAL1_SMALL`, and medium builds finish in ~90 seconds—making on-demand cloud builds effectively pennies per release.
* **Clean-Room Reproducibility:** Every build starts from a pristine, ephemeral Linux environment, guaranteeing that `package-lock.json` (`npm ci`) and PostCSS/Tailwind compilation produce identical, tamper-free artifacts.
* **Ready for GitOps / AWS CodePipeline:** Because `buildspec.yml` already emits `imagedefinitions.json`, connecting GitHub webhooks or AWS CodePipeline for fully automated push-to-deploy requires zero Dockerfile or buildspec changes.
