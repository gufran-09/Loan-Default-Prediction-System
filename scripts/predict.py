#!/usr/bin/env python3
"""
Production XGBoost Inference Engine for Aegis Risk Credit Decisioning.
Accepts borrower features via JSON (stdin or argument), constructs the 31-feature vector,
and performs real XGBoost model inference using ml/model.json.
"""

import sys
import os
import json
import numpy as np
import xgboost as xgb

MODEL_JSON_PATH = os.path.join(os.path.dirname(__file__), "..", "ml", "model.json")
FEATURE_COLS_PATH = os.path.join(os.path.dirname(__file__), "..", "ml", "feature_columns.json")

def load_model_and_features():
    with open(FEATURE_COLS_PATH, "r") as f:
        feature_columns = json.load(f)
    booster = xgb.Booster()
    booster.load_model(MODEL_JSON_PATH)
    return booster, feature_columns

def build_feature_vector(raw_features, feature_columns):
    """
    Map raw borrower features to the exact 31-feature vector used by XGBoost.
    Handles field name variations, normalization, and one-hot encoding.
    """
    f_map = {col: i for i, col in enumerate(feature_columns)}
    vec = np.zeros(len(feature_columns), dtype=np.float32)

    # Numerical features
    age = raw_features.get("age") or raw_features.get("Age") or 43.0
    try:
        age_val = float(age)
    except (ValueError, TypeError):
        age_val = 43.0
    vec[f_map["Age"]] = age_val

    # Income: model expects annual income
    monthly_inc = raw_features.get("monthly_income") or raw_features.get("MonthlyIncome")
    annual_inc = raw_features.get("income") or raw_features.get("Income") or raw_features.get("annual_income")
    if annual_inc is not None:
        inc_val = float(annual_inc)
    elif monthly_inc is not None:
        inc_val = float(monthly_inc) * 12.0
    else:
        inc_val = 60000.0
    vec[f_map["Income"]] = inc_val

    # LoanAmount
    loan_amt = raw_features.get("loan_amount") or raw_features.get("LoanAmount") or 25000.0
    vec[f_map["LoanAmount"]] = float(loan_amt)

    # CreditScore
    cred_score = raw_features.get("credit_score") or raw_features.get("CreditScore") or raw_features.get("alternative_credit_score") or 680.0
    vec[f_map["CreditScore"]] = float(cred_score)

    # MonthsEmployed
    months_emp = (
        raw_features.get("months_employed")
        or raw_features.get("MonthsEmployed")
        or raw_features.get("months_at_current_job")
        or 24.0
    )
    vec[f_map["MonthsEmployed"]] = float(months_emp)

    # NumCreditLines
    num_lines = raw_features.get("num_credit_lines") or raw_features.get("NumCreditLines") or 3.0
    vec[f_map["NumCreditLines"]] = float(num_lines)

    # InterestRate
    int_rate = raw_features.get("interest_rate") or raw_features.get("InterestRate") or 10.5
    vec[f_map["InterestRate"]] = float(int_rate)

    # LoanTerm
    term = (
        raw_features.get("loan_term")
        or raw_features.get("LoanTerm")
        or raw_features.get("tenure_months")
        or 36.0
    )
    vec[f_map["LoanTerm"]] = float(term)

    # DTIRatio
    dti = raw_features.get("dti_ratio") or raw_features.get("DTIRatio")
    if dti is None:
        out_bal = float(raw_features.get("outstanding_balance") or 0.0)
        tot_debt = float(raw_features.get("total_existing_debt") or 0.0)
        dti = (out_bal + tot_debt) / max(inc_val, 10000.0)
    vec[f_map["DTIRatio"]] = float(dti)

    # Categorical: Education
    edu = str(raw_features.get("education") or raw_features.get("Education") or "Bachelor's")
    for val in ["Bachelor's", "High School", "Master's", "PhD"]:
        col = f"Education_{val}"
        if col in f_map:
            vec[f_map[col]] = 1.0 if val.lower() in edu.lower() else 0.0

    # Categorical: EmploymentType
    emp = str(raw_features.get("employment_type") or raw_features.get("EmploymentType") or raw_features.get("employment_status") or "Full-time")
    for val in ["Full-time", "Part-time", "Self-employed", "Unemployed"]:
        col = f"EmploymentType_{val}"
        if col in f_map:
            vec[f_map[col]] = 1.0 if val.lower().replace("-", "") in emp.lower().replace("-", "").replace(" ", "") else 0.0

    # Categorical: MaritalStatus
    marital = str(raw_features.get("marital_status") or raw_features.get("MaritalStatus") or "Single")
    for val in ["Divorced", "Married", "Single"]:
        col = f"MaritalStatus_{val}"
        if col in f_map:
            vec[f_map[col]] = 1.0 if val.lower() in marital.lower() else 0.0

    # Categorical: HasMortgage
    has_mortgage = bool(raw_features.get("has_mortgage") or raw_features.get("HasMortgage", False))
    if "HasMortgage_Yes" in f_map and "HasMortgage_No" in f_map:
        vec[f_map["HasMortgage_Yes"]] = 1.0 if has_mortgage else 0.0
        vec[f_map["HasMortgage_No"]] = 0.0 if has_mortgage else 1.0

    # Categorical: HasDependents
    num_dep = float(raw_features.get("num_dependents") or 0.0)
    has_dep = bool(raw_features.get("has_dependents") or raw_features.get("HasDependents") or (num_dep > 0))
    if "HasDependents_Yes" in f_map and "HasDependents_No" in f_map:
        vec[f_map["HasDependents_Yes"]] = 1.0 if has_dep else 0.0
        vec[f_map["HasDependents_No"]] = 0.0 if has_dep else 1.0

    # Categorical: LoanPurpose
    purpose = str(raw_features.get("loan_purpose") or raw_features.get("LoanPurpose") or raw_features.get("loan_type") or "Other")
    for val in ["Auto", "Business", "Education", "Home", "Other"]:
        col = f"LoanPurpose_{val}"
        if col in f_map:
            vec[f_map[col]] = 1.0 if val.lower() in purpose.lower() else 0.0

    # Categorical: HasCoSigner
    has_cosigner = bool(raw_features.get("has_cosigner") or raw_features.get("has_co_signer") or raw_features.get("HasCoSigner", False))
    if "HasCoSigner_Yes" in f_map and "HasCoSigner_No" in f_map:
        vec[f_map["HasCoSigner_Yes"]] = 1.0 if has_cosigner else 0.0
        vec[f_map["HasCoSigner_No"]] = 0.0 if has_cosigner else 1.0

    # 32. credit_utilization
    if "credit_utilization" in f_map:
        vec[f_map["credit_utilization"]] = float(raw_features.get("credit_utilization", 0.38))

    # 33. delinquency_count_12m
    if "delinquency_count_12m" in f_map:
        vec[f_map["delinquency_count_12m"]] = float(raw_features.get("delinquency_count_12m", raw_features.get("delinquencies_last_12m", 0.0)))

    # 34. num_inquiries_6m
    if "num_inquiries_6m" in f_map:
        vec[f_map["num_inquiries_6m"]] = float(raw_features.get("num_inquiries_6m", raw_features.get("inquiries_last_6m", 1.0)))

    # 35. prior_defaults
    if "prior_defaults" in f_map:
        vec[f_map["prior_defaults"]] = float(raw_features.get("prior_defaults", 0.0))

    # 36. collateral_value
    if "collateral_value" in f_map:
        cv = raw_features.get("collateral_value")
        if cv is None and ("home" in purpose.lower() or "auto" in purpose.lower()):
            cv = loan_amt * 1.1
        vec[f_map["collateral_value"]] = float(cv or 0.0)

    return vec

def predict_borrower(raw_features):
    booster, feature_columns = load_model_and_features()
    vec = build_feature_vector(raw_features, feature_columns)
    
    dmat = xgb.DMatrix(vec.reshape(1, -1), feature_names=feature_columns)
    prob_default = float(booster.predict(dmat)[0])
    score_scaled = int(round(prob_default * 1000))

    # Bucket calculation based on credit probability thresholds
    if prob_default >= 0.65:
        bucket = "CRITICAL"
    elif prob_default >= 0.45:
        bucket = "HIGH"
    elif prob_default >= 0.25:
        bucket = "MEDIUM"
    else:
        bucket = "LOW"

    # Compute TreeSHAP feature contributions
    try:
        contribs = booster.predict(dmat, pred_contribs=True)[0]
        # contribs length is len(feature_columns) + 1 (last is bias)
        bias = float(contribs[-1])
        shap_values = {feature_columns[i]: round(float(contribs[i]), 4) for i in range(len(feature_columns))}
    except Exception:
        shap_values = {}
        bias = 0.0

    # Human-readable risk reasons sorted by impact
    sorted_features = sorted(shap_values.items(), key=lambda x: abs(x[1]), reverse=True)
    reasons = []
    lime_explanations = []

    for rank, (feat, impact) in enumerate(sorted_features[:5], start=1):
        direction = "increases" if impact > 0 else "decreases"
        desc = f"Feature {feat} {direction} default risk by {abs(impact):.3f} log-odds"
        if feat == "Income":
            desc = f"Annual income of ${int(vec[feature_columns.index('Income')]):,} {'reduces debt service stress' if impact < 0 else 'is lower relative to requested credit'}"
        elif feat == "LoanAmount":
            desc = f"Requested principal of ${int(vec[feature_columns.index('LoanAmount')]):,} {'strains repayment capacity' if impact > 0 else 'is modest'}"
        elif feat == "DTIRatio":
            desc = f"Debt-to-income ratio ({vec[feature_columns.index('DTIRatio')]*100:.1f}%) {'elevates default risk' if impact > 0 else 'is well controlled'}"
        elif feat == "CreditScore":
            desc = f"Credit score of {int(vec[feature_columns.index('CreditScore')])} {'demonstrates strong creditworthiness' if impact < 0 else 'indicates higher delinquency risk'}"
        elif feat == "InterestRate":
            desc = f"Loan interest rate of {vec[feature_columns.index('InterestRate')]:.1f}% {'adds borrowing cost burden' if impact > 0 else 'keeps payments manageable'}"
        elif feat == "credit_utilization":
            desc = f"Revolving credit line utilization ({vec[feature_columns.index('credit_utilization')]*100:.1f}%) {'signals heavy reliance on credit' if impact > 0 else 'demonstrates disciplined utilization'}"
        elif feat == "delinquency_count_12m":
            desc = f"{int(vec[feature_columns.index('delinquency_count_12m')])} delinquency incident(s) in last 12 months {'substantially elevates risk' if impact > 0 else 'indicates clean payment track'}"
        elif feat == "num_inquiries_6m":
            desc = f"{int(vec[feature_columns.index('num_inquiries_6m')])} credit inquiries in last 6 months {'suggests credit distress' if impact > 0 else 'reflects controlled borrowing inquiries'}"
        elif feat == "prior_defaults":
            desc = f"{int(vec[feature_columns.index('prior_defaults')])} historical defaults on record {'markedly increases default risk' if impact > 0 else 'maintains unblemished credit record'}"
        elif feat == "collateral_value":
            desc = f"Collateral value of ${int(vec[feature_columns.index('collateral_value')]):,} {'mitigates loss given default' if impact < 0 else 'provides zero secured coverage'}"

        reasons.append({
            "rank": rank,
            "feature": feat,
            "impact": impact,
            "reason": desc
        })
        lime_explanations.append({
            "feature": feat,
            "explanation": desc,
            "direction": direction,
            "magnitude": round(abs(impact), 3)
        })

    return {
        "score": score_scaled,
        "default_probability": round(prob_default, 4),
        "bucket": bucket,
        "model_version": "v2.1-xgboost",
        "scored_by": "Native XGBoost Inference Engine (TreeSHAP)",
        "shap_values": shap_values,
        "risk_reasons": reasons,
        "lime_explanations": lime_explanations
    }

def main():
    raw_input = ""
    if len(sys.argv) > 1:
        raw_input = sys.argv[1]
    else:
        raw_input = sys.stdin.read()

    try:
        features = json.loads(raw_input) if raw_input.strip() else {}
    except Exception as e:
        print(json.dumps({"error": f"Invalid JSON input: {str(e)}"}))
        sys.exit(1)

    result = predict_borrower(features)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
