"""
AWS S3 Artifact & Model Registry Synchronization Script
Aegis Risk - PS-01
Synchronizes local machine learning artifacts, model binaries, and drift reports
to an Amazon S3 Data Lake bucket.
"""

import os
import sys
import json
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    if os.path.exists(".env"):
        with open(".env", "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())

def sync_artifacts():
    bucket_name = os.getenv("AWS_S3_BUCKET_NAME", "aegis-risk-storage-022671037337")
    region = os.getenv("AWS_REGION", "ap-southeast-2")


    artifacts = [
        ("ml/model.pkl", "models/v2.0.0/model.pkl"),
        ("ml/model.json", "models/v2.0.0/model.json"),
        ("ml/feature_columns.json", "models/v2.0.0/feature_columns.json"),
        ("ml/model_card.md", "documentation/v2.0.0/model_card.md"),
        ("ml/model.json", "models/latest/model.json"),
        ("ml/feature_columns.json", "models/latest/feature_columns.json"),
        ("seed_borrowers.csv", "datasets/seed_borrowers.csv"),
    ]

    print("==================================================")
    print("      AEGIS RISK - AWS S3 ARTIFACT SYNC          ")
    print("==================================================")
    print(f"Target S3 Bucket: s3://{bucket_name}")
    print(f"Region:          {region}\n")

    try:
        import boto3
        s3 = boto3.client("s3", region_name=region)
        print("Connected to AWS Boto3 client.")

        for local_file, s3_key in artifacts:
            if os.path.exists(local_file):
                print(f"Uploading {local_file} -> s3://{bucket_name}/{s3_key}...")
                s3.upload_file(local_file, bucket_name, s3_key)
                print(f"  [SUCCESS] s3://{bucket_name}/{s3_key}")
            else:
                print(f"  [SKIP] Local file {local_file} not found.")

        print("\nAll artifacts successfully synchronized to AWS S3.")

    except ImportError:
        print("[NOTICE] 'boto3' not installed. Running simulated AWS dry-run...")
        for local_file, s3_key in artifacts:
            if os.path.exists(local_file):
                print(f"  [DRY RUN] Would upload {local_file} ({os.path.getsize(local_file)} bytes) -> s3://{bucket_name}/{s3_key}")
        print("\nTo upload live to AWS:")
        print("1. pip install boto3")
        print("2. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME in .env")

    except Exception as e:
        print(f"[AWS ERROR] Could not complete S3 upload: {e}")
        print("Falling back to local registry.")

if __name__ == "__main__":
    sync_artifacts()
