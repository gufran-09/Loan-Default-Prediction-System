import os
import csv
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

load_dotenv()

def seed_rds():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not found in .env. Exiting.")
        return

    print("Connecting to Amazon RDS PostgreSQL...")
    conn = psycopg2.connect(database_url, sslmode="require")
    cur = conn.cursor()

    # 1. Apply Schema Migrations
    print("Creating standard roles and applying initial schema migrations...")
    cur.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                CREATE ROLE authenticated;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
                CREATE ROLE anon;
            END IF;
        END $$;
    """)
    conn.commit()

    for migration_file in ["supabase/migrations/0001_init.sql", "supabase/migrations/0002_alerts_update.sql"]:
        if os.path.exists(migration_file):
            print(f"Executing {migration_file}...")
            with open(migration_file, "r", encoding="utf-8") as f:
                cur.execute(f.read())
    conn.commit()
    print("Schema and alert triggers created successfully on RDS.")

    # 2. Ingest Borrowers
    print("Ingesting seed_borrowers.csv...")
    borrowers = []
    with open("seed_borrowers.csv", mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        idx = 1
        for row in reader:
            ext_id = f"LN-{idx:06d}"
            idx += 1
            borrowers.append((
                row["id"],
                ext_id,
                row["name"],
                row["email"],
                row["loan_purpose"],
                float(row["loan_amount"]),
                float(row["outstanding_balance"]),
                row["geography"],
                int(row["tenure_months"]),
                float(row["monthly_income"]),
                row["employment_type"]
            ))

    execute_values(
        cur,
        """
        INSERT INTO borrowers (id, external_id, full_name, email, loan_type, loan_amount, outstanding_balance, geography, tenure_months, monthly_income, employment_status)
        VALUES %s
        ON CONFLICT (id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            email = EXCLUDED.email,
            loan_amount = EXCLUDED.loan_amount,
            outstanding_balance = EXCLUDED.outstanding_balance;
        """,
        borrowers
    )
    conn.commit()
    print(f"Upserted {len(borrowers)} borrowers into Amazon RDS.")

    # 3. Ingest Risk Scores & Reasons
    print("Ingesting seed_scores_reasons.csv...")
    risk_scores = {}
    risk_reasons = []

    with open("seed_scores_reasons.csv", mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            score_id = row["score_id"]
            if score_id not in risk_scores:
                risk_scores[score_id] = (
                    score_id,
                    row["borrower_id"],
                    float(row["score"]),
                    row["bucket"].lower(),
                    row["model_version"]
                )

            rank = len([r for r in risk_reasons if r[0] == score_id]) + 1
            reason_text = row.get("description") or f"Impact of {row.get('feature_name')}"
            risk_reasons.append((
                score_id,
                reason_text,
                row["feature_name"],
                float(row["impact_magnitude"]),
                rank
            ))

    execute_values(
        cur,
        """
        INSERT INTO risk_scores (id, borrower_id, score, bucket, model_version)
        VALUES %s
        ON CONFLICT (id) DO NOTHING;
        """,
        list(risk_scores.values())
    )
    conn.commit()
    print(f"Upserted {len(risk_scores)} risk scores (PostgreSQL triggers activated for alerts).")

    execute_values(
        cur,
        """
        INSERT INTO risk_reasons (risk_score_id, reason, feature, impact, rank)
        VALUES %s
        ON CONFLICT (id) DO NOTHING;
        """,
        risk_reasons
    )
    conn.commit()
    print(f"Upserted {len(risk_reasons)} TreeSHAP risk attributions into Amazon RDS.")

    cur.close()
    conn.close()
    print("Amazon RDS PostgreSQL full migration and seeding completed!")

if __name__ == "__main__":
    seed_rds()
