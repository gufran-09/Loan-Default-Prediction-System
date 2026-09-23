"""
Fair Lending & Demographic Disparate Impact Audit (ECOA / CFPB Reg B)
Aegis Risk - Institutional Model Risk Governance (Federal Reserve SR 11-7)

Evaluates Adverse Impact Ratio (AIR) and enforces the Four-Fifths Rule (80% benchmark)
across demographic groups (Age & Marital Status).
"""

import json
import os
import numpy as np
import pandas as pd
import xgboost as xgb

def run_fair_lending_audit():
    print("==========================================================")
    print("  AEGIS RISK - FAIR LENDING & DISPARATE IMPACT AUDIT      ")
    print("  (Equal Credit Opportunity Act & CFPB Regulation B)      ")
    print("==========================================================")

    data_path = "Loan_default_v2.csv"
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"{data_path} not found.")

    df = pd.read_csv(data_path)
    df = df[df['default_label'].notna()].copy()
    print(f"Auditing cohort: {len(df):,} seasoned loan applications")

    # Load production model and features
    booster = xgb.Booster()
    booster.load_model("ml/model.json")
    with open("ml/feature_columns.json", "r") as f:
        feature_columns = json.load(f)

    X = df[feature_columns].copy()
    dmat = xgb.DMatrix(X, feature_names=feature_columns)
    df['pred_prob'] = booster.predict(dmat)

    # Standard underwriting approval threshold: Approved if default probability <= 0.45
    APPROVAL_THRESHOLD = 0.45
    df['is_approved'] = (df['pred_prob'] <= APPROVAL_THRESHOLD).astype(int)

    overall_approval_rate = float(df['is_approved'].mean())
    print(f"Overall Portfolio Approval Rate: {overall_approval_rate*100:.2f}%\n")

    audit_results = {
        "regulatory_standard": "ECOA / CFPB Regulation B / Four-Fifths Rule (80% AIR)",
        "approval_threshold_pd": APPROVAL_THRESHOLD,
        "overall_approval_rate": round(overall_approval_rate, 4),
        "demographic_evaluations": {},
        "compliance_summary": "COMPLIANT"
    }

    # 1. Audit Age Slices (< 30, 30-50, > 50)
    print("--- 1. Age Cohort Fairness Audit ---")
    age_groups = {
        "Emerging Credit (< 30 yrs)": df['Age'] < 30,
        "Prime Working (30 - 50 yrs)": (df['Age'] >= 30) & (df['Age'] <= 50),
        "Mature / Senior (> 50 yrs)": df['Age'] > 50
    }

    # Benchmark group is Prime Working (30 - 50 yrs)
    benchmark_age_mask = age_groups["Prime Working (30 - 50 yrs)"]
    benchmark_age_rate = float(df.loc[benchmark_age_mask, 'is_approved'].mean())

    age_audit = {}
    for group_name, mask in age_groups.items():
        count = int(mask.sum())
        appr_rate = float(df.loc[mask, 'is_approved'].mean())
        air = appr_rate / benchmark_age_rate if benchmark_age_rate > 0 else 1.0
        four_fifths_passed = air >= 0.80

        print(f"  {group_name}: n={count:,} | Approval Rate: {appr_rate*100:.2f}% | AIR: {air:.3f} | Four-Fifths: {'PASSED' if four_fifths_passed else 'FLAGGED'}")
        age_audit[group_name] = {
            "applicant_count": count,
            "approval_rate": round(appr_rate, 4),
            "adverse_impact_ratio": round(air, 4),
            "four_fifths_compliant": four_fifths_passed
        }

    audit_results["demographic_evaluations"]["age_cohorts"] = {
        "benchmark_group": "Prime Working (30 - 50 yrs)",
        "benchmark_approval_rate": round(benchmark_age_rate, 4),
        "groups": age_audit
    }

    # 2. Audit Marital Status Slices (Married vs Single vs Divorced)
    print("\n--- 2. Marital Status Fairness Audit ---")
    marital_groups = {
        "Married": df['MaritalStatus_Married'] == 1,
        "Single": df['MaritalStatus_Single'] == 1,
        "Divorced": df['MaritalStatus_Divorced'] == 1
    }

    benchmark_marital_mask = marital_groups["Married"]
    benchmark_marital_rate = float(df.loc[benchmark_marital_mask, 'is_approved'].mean())

    marital_audit = {}
    for group_name, mask in marital_groups.items():
        count = int(mask.sum())
        appr_rate = float(df.loc[mask, 'is_approved'].mean())
        air = appr_rate / benchmark_marital_rate if benchmark_marital_rate > 0 else 1.0
        four_fifths_passed = air >= 0.80

        print(f"  {group_name}: n={count:,} | Approval Rate: {appr_rate*100:.2f}% | AIR: {air:.3f} | Four-Fifths: {'PASSED' if four_fifths_passed else 'FLAGGED'}")
        marital_audit[group_name] = {
            "applicant_count": count,
            "approval_rate": round(appr_rate, 4),
            "adverse_impact_ratio": round(air, 4),
            "four_fifths_compliant": four_fifths_passed
        }

    audit_results["demographic_evaluations"]["marital_status"] = {
        "benchmark_group": "Married",
        "benchmark_approval_rate": round(benchmark_marital_rate, 4),
        "groups": marital_audit
    }

    # Check overall compliance
    all_compliant = all(
        g["four_fifths_compliant"] 
        for cat in audit_results["demographic_evaluations"].values() 
        for g in cat["groups"].values()
    )
    audit_results["compliance_summary"] = "COMPLIANT (AIR >= 0.80 across all cohorts)" if all_compliant else "FLAGGED_FOR_HUMAN_OVERSIGHT"

    # Export report
    output_path = os.path.join("ml", "fair_lending_audit.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(audit_results, f, indent=2)

    print(f"\nAudit complete. Formal report generated at: {output_path}")
    print(f"Overall ECOA Status: {audit_results['compliance_summary']}")

if __name__ == "__main__":
    run_fair_lending_audit()
