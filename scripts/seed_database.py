import os
import csv
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

raw_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL") or ""
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or ""

# Clean up URL formatting
supabase_url = raw_url.strip().rstrip('/')

if not supabase_url or not supabase_key:
    raise ValueError("Missing Supabase credentials in .env file.")

supabase: Client = create_client(supabase_url, supabase_key)

def seed():
    print("Starting database seeding...")

    # 1. Read seed_borrowers.csv
    borrowers = []
    with open("seed_borrowers.csv", mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            borrowers.append({
                "id": row["id"],
                "external_id": row["external_id"],
                "full_name": row["full_name"],
                "email": row["email"],
                "loan_type": row["loan_type"],
                "loan_amount": float(row["loan_amount"]),
                "outstanding_balance": float(row["outstanding_balance"]),
                "geography": row["geography"],
                "tenure_months": int(row["tenure_months"]),
                "monthly_income": float(row["monthly_income"]),
                "employment_status": row["employment_status"]
            })

    print(f"Upserting {len(borrowers)} borrowers...")
    supabase.table("borrowers").upsert(borrowers).execute()
    print("Borrowers upserted successfully.")

    # 2. Read seed_scores_reasons.csv
    risk_scores = {}
    risk_reasons = []

    with open("seed_scores_reasons.csv", mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            score_id = row["score_id"]
            if score_id not in risk_scores:
                risk_scores[score_id] = {
                    "id": score_id,
                    "borrower_id": row["borrower_id"],
                    "score": float(row["score"]),
                    "bucket": row["bucket"],
                    "model_version": row["model_version"]
                }
            
            # Map SHAP reason columns to database schema
            rank = len([r for r in risk_reasons if r["risk_score_id"] == score_id]) + 1
            risk_reasons.append({
                "risk_score_id": score_id,
                "reason": row["reason"],
                "feature": row["feature_name"],
                "impact": float(row["impact_magnitude"]),
                "rank": rank
            })

    scores_list = list(risk_scores.values())
    print(f"Upserting {len(scores_list)} risk scores...")
    supabase.table("risk_scores").upsert(scores_list).execute()
    print("Risk scores upserted successfully (triggers will generate high/critical alerts).")

    print(f"Upserting {len(risk_reasons)} risk reasons...")
    # Batch insertion in chunks of 200
    chunk_size = 200
    for i in range(0, len(risk_reasons), chunk_size):
        chunk = risk_reasons[i:i + chunk_size]
        supabase.table("risk_reasons").upsert(chunk).execute()

    print("Risk reasons upserted successfully.")
    print("Database seeding completed!")

if __name__ == "__main__":
    seed()