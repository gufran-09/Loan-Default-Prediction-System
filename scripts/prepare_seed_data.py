import os
import uuid
import json
import pandas as pd
import numpy as np
import xgboost as xgb

def get_one_hot_label(row, prefix, default_val):
    for col in row.index:
        if col.startswith(prefix) and row[col] == 1:
            return col[len(prefix):]
    return default_val

def generate_seed_data():
    print("Loading Loan_default_v2.csv for seed generation...")
    data_path = "Loan_default_v2.csv"
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"{data_path} not found. Ensure dataset is in root.")

    df = pd.read_csv(data_path)

    # Sample 400 profiles with balanced distribution
    seed_df = df.sample(n=400, random_state=42).copy()
    seed_df['id'] = [str(uuid.uuid4()) for _ in range(len(seed_df))]

    # Load retrained booster and feature columns for deterministic real inference
    booster = xgb.Booster()
    booster.load_model("ml/model.json")
    with open("ml/feature_columns.json", "r") as f:
        feature_columns = json.load(f)

    # 1. Prepare seed_borrowers.csv
    borrowers_data = []
    for idx, row in seed_df.iterrows():
        edu = get_one_hot_label(row, "Education_", "Bachelor's")
        emp = get_one_hot_label(row, "EmploymentType_", "Full-time")
        marital = get_one_hot_label(row, "MaritalStatus_", "Single")
        purpose = get_one_hot_label(row, "LoanPurpose_", "Auto")

        income = float(row['Income']) if pd.notna(row['Income']) else 60000.0
        cred_score = int(row['CreditScore']) if pd.notna(row['CreditScore']) else 680
        age = int(row['Age']) if pd.notna(row['Age']) else 43
        months_emp = int(row['MonthsEmployed']) if pd.notna(row['MonthsEmployed']) else 24

        borrower = {
            "id": row['id'],
            "full_name": f"Borrower_{row['id'][:8]}",
            "email": f"user_{row['id'][:8]}@example.com",
            "age": age,
            "income": round(income, 2),
            "loan_amount": round(float(row.get('LoanAmount', 25000)), 2),
            "credit_score": cred_score,
            "months_employed": months_emp,
            "num_credit_lines": int(row.get('NumCreditLines', 3)),
            "interest_rate": round(float(row.get('InterestRate', 10.5)), 2),
            "loan_term": int(row.get('LoanTerm', 36)),
            "dti_ratio": round(float(row.get('DTIRatio', 0.35)), 4),
            "education": edu,
            "employment_type": emp,
            "marital_status": marital,
            "has_mortgage": bool(row.get('HasMortgage_Yes', 0) == 1),
            "has_dependents": bool(row.get('HasDependents_Yes', 0) == 1),
            "loan_purpose": purpose,
            "has_cosigner": bool(row.get('HasCoSigner_Yes', 0) == 1),
            "credit_utilization": round(float(row.get('credit_utilization', 0.38)), 4),
            "delinquency_count_12m": int(row.get('delinquency_count_12m', 0)),
            "num_inquiries_6m": int(row.get('num_inquiries_6m', 1)),
            "prior_defaults": int(row.get('prior_defaults', 0)),
            "collateral_value": round(float(row.get('collateral_value', 0.0)), 2),
        }
        borrowers_data.append(borrower)

    borrowers_df = pd.DataFrame(borrowers_data)
    borrowers_df.to_csv("seed_borrowers.csv", index=False)
    print("Generated seed_borrowers.csv successfully (400 records from v2).")

    # 2. Compute Real XGBoost TreeSHAP predictions for seed_scores_reasons.csv
    f_map = {col: i for i, col in enumerate(feature_columns)}
    scores_reasons_data = []

    for b in borrowers_data:
        vec = np.zeros(len(feature_columns), dtype=np.float32)
        vec[f_map["Age"]] = float(b["age"])
        vec[f_map["Income"]] = float(b["income"])
        vec[f_map["LoanAmount"]] = float(b["loan_amount"])
        vec[f_map["CreditScore"]] = float(b["credit_score"])
        vec[f_map["MonthsEmployed"]] = float(b["months_employed"])
        vec[f_map["NumCreditLines"]] = float(b["num_credit_lines"])
        vec[f_map["InterestRate"]] = float(b["interest_rate"])
        vec[f_map["LoanTerm"]] = float(b["loan_term"])
        vec[f_map["DTIRatio"]] = float(b["dti_ratio"])

        edu_col = f"Education_{b['education']}"
        if edu_col in f_map:
            vec[f_map[edu_col]] = 1.0

        emp_col = f"EmploymentType_{b['employment_type']}"
        if emp_col in f_map:
            vec[f_map[emp_col]] = 1.0

        mar_col = f"MaritalStatus_{b['marital_status']}"
        if mar_col in f_map:
            vec[f_map[mar_col]] = 1.0

        if b["has_mortgage"]:
            vec[f_map["HasMortgage_Yes"]] = 1.0
        else:
            vec[f_map["HasMortgage_No"]] = 1.0

        if b["has_dependents"]:
            vec[f_map["HasDependents_Yes"]] = 1.0
        else:
            vec[f_map["HasDependents_No"]] = 1.0

        purp_col = f"LoanPurpose_{b['loan_purpose']}"
        if purp_col in f_map:
            vec[f_map[purp_col]] = 1.0

        if b["has_cosigner"]:
            vec[f_map["HasCoSigner_Yes"]] = 1.0
        else:
            vec[f_map["HasCoSigner_No"]] = 1.0

        if "credit_utilization" in f_map:
            vec[f_map["credit_utilization"]] = float(b["credit_utilization"])
        if "delinquency_count_12m" in f_map:
            vec[f_map["delinquency_count_12m"]] = float(b["delinquency_count_12m"])
        if "num_inquiries_6m" in f_map:
            vec[f_map["num_inquiries_6m"]] = float(b["num_inquiries_6m"])
        if "prior_defaults" in f_map:
            vec[f_map["prior_defaults"]] = float(b["prior_defaults"])
        if "collateral_value" in f_map:
            vec[f_map["collateral_value"]] = float(b["collateral_value"])

        dmat = xgb.DMatrix(vec.reshape(1, -1), feature_names=feature_columns)
        prob = float(booster.predict(dmat)[0])
        contribs = booster.predict(dmat, pred_contribs=True)[0]

        shap_dict = {feature_columns[i]: round(float(contribs[i]), 4) for i in range(len(feature_columns))}
        top_shap = sorted(shap_dict.items(), key=lambda x: abs(x[1]), reverse=True)[:3]
        reasons_str = "|".join([f"{k} impact: {v:+.3f}" for k, v in top_shap])

        scores_reasons_data.append({
            "borrower_id": b["id"],
            "risk_score": round(prob, 4),
            "top_reasons": reasons_str,
            "shap_age": shap_dict.get("Age", 0.0),
            "shap_income": shap_dict.get("Income", 0.0),
            "shap_dti": shap_dict.get("DTIRatio", 0.0),
            "shap_credit_score": shap_dict.get("CreditScore", 0.0),
        })

    scores_df = pd.DataFrame(scores_reasons_data)
    scores_df.to_csv("seed_scores_reasons.csv", index=False)
    print("Generated seed_scores_reasons.csv successfully (400 records with real TreeSHAP values).")

if __name__ == "__main__":
    generate_seed_data()
