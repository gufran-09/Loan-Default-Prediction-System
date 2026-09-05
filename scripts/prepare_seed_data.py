import os
import uuid
import pandas as pd
import numpy as np

def generate_seed_data():
    print("Loading cleaned dataset for seed generation...")
    data_path = "Loan_default_cleaned.csv"
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"{data_path} not found. Ensure dataset is in root.")

    df = pd.read_csv(data_path)

    # Sample 400 profiles to match DB seeding requirement
    seed_df = df.sample(n=400, random_state=42).copy()

    # Generate persistent UUIDs for database seeding
    seed_df['id'] = [str(uuid.uuid4()) for _ in range(len(seed_df))]

    # 1. Prepare seed_borrowers.csv (Matching Supabase borrowers schema)
    borrowers_data = []
    for idx, row in seed_df.iterrows():
        # Derive risk category based on Default flag and DTI/Income metrics
        if row.get('Default', 0) == 1:
            risk_category = 'HIGH' if row.get('DTIRatio', 0.4) > 0.45 else 'CRITICAL'
        else:
            risk_category = 'LOW' if row.get('CreditScore', 700) > 680 else 'MEDIUM'

        borrower = {
            "id": row['id'],
            "full_name": f"Borrower_{row['id'][:8]}",
            "email": f"user_{row['id'][:8]}@example.com",
            "age": int(row.get('Age', 35)),
            "income": float(row.get('Income', 50000)),
            "loan_amount": float(row.get('LoanAmount', 15000)),
            "credit_score": int(row.get('CreditScore', 650)),
            "months_employed": int(row.get('MonthsEmployed', 24)),
            "num_credit_lines": int(row.get('NumCreditLines', 3)),
            "interest_rate": float(row.get('InterestRate', 10.5)),
            "loan_term": int(row.get('LoanTerm', 36)),
            "dti_ratio": float(row.get('DTIRatio', 0.35)),
            "education": str(row.get('Education', "Bachelor's")),
            "employment_type": str(row.get('EmploymentType', 'Full-time')),
            "marital_status": str(row.get('MaritalStatus', 'Single')),
            "has_mortgage": bool(row.get('HasMortgage', False)),
            "has_dependents": bool(row.get('HasDependents', False)),
            "loan_purpose": str(row.get('LoanPurpose', 'Auto')),
            "has_cosigner": bool(row.get('HasCoSigner', False)),
            "risk_category": risk_category
        }
        borrowers_data.append(borrower)

    borrowers_df = pd.DataFrame(borrowers_data)
    borrowers_df.to_csv("seed_borrowers.csv", index=False)
    print("Generated seed_borrowers.csv successfully (400 records).")

    # 2. Prepare seed_scores_reasons.csv (SHAP Risk & Explainability schema)
    scores_reasons_data = []
    for idx, row in seed_df.iterrows():
        # Generate synthetic SHAP probability score consistent with risk category
        if row.get('Default', 0) == 1:
            risk_score = round(float(np.random.uniform(0.65, 0.95)), 4)
        else:
            risk_score = round(float(np.random.uniform(0.05, 0.45)), 4)

        # High risk drivers (SHAP reasoning triggers)
        reasons = []
        if row.get('DTIRatio', 0.3) > 0.4:
            reasons.append("High Debt-to-Income Ratio")
        if row.get('CreditScore', 700) < 620:
            reasons.append("Low Credit Score")
        if row.get('InterestRate', 10) > 15:
            reasons.append("Elevated Loan Interest Rate")
        if row.get('MonthsEmployed', 24) < 12:
            reasons.append("Short Employment History")

        if not reasons:
            reasons = ["Standard Risk Profile"]

        score_entry = {
            "borrower_id": row['id'],
            "risk_score": risk_score,
            "top_reasons": "|".join(reasons),
            "shap_age": round(float(np.random.normal(0.02, 0.01)), 4),
            "shap_income": round(float(np.random.normal(-0.05, 0.02)), 4),
            "shap_dti": round(float(np.random.normal(0.08, 0.03)), 4),
            "shap_credit_score": round(float(np.random.normal(-0.06, 0.02)), 4)
        }
        scores_reasons_data.append(score_entry)

    scores_df = pd.DataFrame(scores_reasons_data)
    scores_df.to_csv("seed_scores_reasons.csv", index=False)
    print("Generated seed_scores_reasons.csv successfully (400 records).")

if __name__ == "__main__":
    generate_seed_data()
