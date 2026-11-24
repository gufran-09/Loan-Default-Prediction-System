"""
Production Deployment Script for Loan Sentry (loansentry.in)
Packages source, uploads to S3, triggers AWS CodeBuild, restarts ECS Fargate, and invalidates CloudFront.
"""

import os
import sys
import time
import zipfile
import subprocess
from pathlib import Path

AWS_REGION = "ap-southeast-2"
S3_BUCKET = "aegis-risk-storage-022671037337"
S3_KEY = "build/source.zip"
CODEBUILD_PROJECT = "aegis-risk-build"
ECS_CLUSTER = "aegis-risk-cluster"
ECS_SERVICE = "aegis-risk-service"
CLOUDFRONT_DIST_ID = "E2WK4WS85BY6CX"

PROJECT_ROOT = Path(__file__).resolve().parents[1]

# Directories and files to include in source.zip
INCLUDE_DIRS = ["app", "components", "lib", "ml", "public"]
INCLUDE_FILES = [
    "package.json",
    "package-lock.json",
    "next.config.mjs",
    "postcss.config.mjs",
    "components.json",
    "tsconfig.json",
    "next-env.d.ts",
    "proxy.ts",
    "Dockerfile",
    ".dockerignore",
    "buildspec.yml",
]

def run_cmd(args, check=True):
    print(f"Executing: {' '.join(args)}")
    result = subprocess.run(args, capture_output=True, text=True)
    if check and result.returncode != 0:
        print(f"Error ({result.returncode}):\n{result.stderr}")
        raise RuntimeError(f"Command failed: {' '.join(args)}")
    return result

def create_source_zip(output_path: Path):
    print(f"\n[1/5] Creating source archive: {output_path}...")
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
        # Add explicit root files
        for fname in INCLUDE_FILES:
            fpath = PROJECT_ROOT / fname
            if fpath.exists():
                # Force forward slashes for Linux Docker compatibility
                arcname = fname.replace("\\", "/")
                zf.write(fpath, arcname=arcname)
                print(f"  Added: {arcname}")

        # Add directories recursively
        for dname in INCLUDE_DIRS:
            dpath = PROJECT_ROOT / dname
            if dpath.exists():
                for root, _, files in os.walk(dpath):
                    for file in files:
                        full_path = Path(root) / file
                        # Skip temporary, test logs or caches
                        if "__pycache__" in str(full_path) or ".DS_Store" in str(full_path):
                            continue
                        rel_path = full_path.relative_to(PROJECT_ROOT)
                        arcname = str(rel_path).replace("\\", "/")
                        zf.write(full_path, arcname=arcname)

    size_kb = output_path.stat().st_size / 1024
    print(f"  Archive created successfully ({size_kb:.1f} KB).")

def main():
    print("======================================================================")
    print("  LOAN SENTRY — PRODUCTION CLOUD DEPLOYMENT PIPELINE (CLI)            ")
    print("======================================================================")
    
    zip_path = PROJECT_ROOT / "source.zip"
    try:
        # 1. Package source
        create_source_zip(zip_path)

        # 2. Upload to S3
        print(f"\n[2/5] Uploading source.zip to s3://{S3_BUCKET}/{S3_KEY}...")
        run_cmd([
            "aws", "s3", "cp", str(zip_path), f"s3://{S3_BUCKET}/{S3_KEY}",
            "--region", AWS_REGION
        ])
        print("  Upload complete.")

        # 3. Trigger AWS CodeBuild
        print(f"\n[3/5] Starting AWS CodeBuild project '{CODEBUILD_PROJECT}' in {AWS_REGION}...")
        start_res = run_cmd([
            "aws", "codebuild", "start-build",
            "--project-name", CODEBUILD_PROJECT,
            "--region", AWS_REGION,
            "--query", "build.id",
            "--output", "text"
        ])
        build_id = start_res.stdout.strip()
        print(f"  Build started with ID: {build_id}")

        print("  Monitoring build progress (compiling Next.js 16 Docker container)...")
        while True:
            time.sleep(10)
            status_res = run_cmd([
                "aws", "codebuild", "batch-get-builds",
                "--ids", build_id,
                "--region", AWS_REGION,
                "--query", "builds[0].[currentPhase,buildStatus]",
                "--output", "text"
            ])
            phase_and_status = status_res.stdout.strip().split("\t")
            phase = phase_and_status[0] if len(phase_and_status) > 0 else "UNKNOWN"
            status = phase_and_status[1] if len(phase_and_status) > 1 else "IN_PROGRESS"
            
            print(f"  -> Phase: {phase:<15} | Status: {status}")
            
            if status == "SUCCEEDED":
                print("  Container build and ECR push SUCCEEDED!")
                break
            elif status in ["FAILED", "FAULT", "STOPPED", "TIMED_OUT"]:
                print(f"  ERROR: CodeBuild terminated with status: {status}")
                # Fetch recent log stream
                run_cmd([
                    "aws", "codebuild", "batch-get-builds",
                    "--ids", build_id,
                    "--region", AWS_REGION,
                    "--query", "builds[0].logs.deepLink",
                    "--output", "text"
                ], check=False)
                sys.exit(1)

        # 4. Force ECS Fargate Deployment
        print(f"\n[4/5] Updating ECS Fargate service '{ECS_SERVICE}' in cluster '{ECS_CLUSTER}'...")
        run_cmd([
            "aws", "ecs", "update-service",
            "--cluster", ECS_CLUSTER,
            "--service", ECS_SERVICE,
            "--force-new-deployment",
            "--region", AWS_REGION,
            "--query", "service.{serviceName:serviceName, status:status, desiredCount:desiredCount}",
            "--output", "json"
        ])
        print("  ECS service rollout initiated (new Fargate task booting with latest ECR image).")

        # 5. Invalidate CloudFront Cache
        print(f"\n[5/5] Creating CloudFront cache invalidation on distribution '{CLOUDFRONT_DIST_ID}'...")
        inv_res = run_cmd([
            "aws", "cloudfront", "create-invalidation",
            "--distribution-id", CLOUDFRONT_DIST_ID,
            "--paths", "/*",
            "--query", "Invalidation.{Id:Id, Status:Status, CreateTime:CreateTime}",
            "--output", "json"
        ])
        print(f"  Invalidation created:\n{inv_res.stdout}")

        print("\n======================================================================")
        print("  DEPLOYMENT TRIGGERED SUCCESSFULLY!                                  ")
        print("  - Docker Image built and pushed to Amazon ECR                       ")
        print("  - ECS Fargate service rolling out fresh container                   ")
        print("  - CloudFront edge cache cleared across all global PoPs              ")
        print("  - Live URL: https://www.loansentry.in                               ")
        print("======================================================================")

    finally:
        # Clean up local zip
        if zip_path.exists():
            zip_path.unlink()

if __name__ == "__main__":
    main()
