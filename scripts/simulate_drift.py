import os
import json
import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.metrics import roc_auc_score

def run_drift_simulation():
    print("Loading data for drift simulation from Loan_default_v2.csv...")
    data_path = "Loan_default_v2.csv"
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"{data_path} not found.")

    df = pd.read_csv(data_path)
    
    # Filter to mature/seasoned loans with verified default labels
    df = df[df['default_label'].notna()].copy()
    df['Age'] = df['Age'].fillna(43.0)

    # Demographic split based on Age (< 40 vs >= 40)
    train_df = df[df['Age'] < 40]
    test_df = df[df['Age'] >= 40]

    print(f"Training set (Age < 40) shape: {train_df.shape}")
    print(f"Testing set (Age >= 40) shape: {test_df.shape}")

    # Core 31 feature columns
    feature_cols = [
        "Age", "Income", "LoanAmount", "CreditScore", "MonthsEmployed",
        "NumCreditLines", "InterestRate", "LoanTerm", "DTIRatio",
        "Education_Bachelor's", "Education_High School", "Education_Master's", "Education_PhD",
        "EmploymentType_Full-time", "EmploymentType_Part-time", "EmploymentType_Self-employed", "EmploymentType_Unemployed",
        "MaritalStatus_Divorced", "MaritalStatus_Married", "MaritalStatus_Single",
        "HasMortgage_No", "HasMortgage_Yes",
        "HasDependents_No", "HasDependents_Yes",
        "LoanPurpose_Auto", "LoanPurpose_Business", "LoanPurpose_Education", "LoanPurpose_Home", "LoanPurpose_Other",
        "HasCoSigner_No", "HasCoSigner_Yes"
    ]

    X_train, y_train = train_df[feature_cols], train_df['default_label'].astype(int)
    X_test, y_test = test_df[feature_cols], test_df['default_label'].astype(int)

    dtrain = xgb.DMatrix(X_train, label=y_train)
    dtest = xgb.DMatrix(X_test, label=y_test)

    print("Training drift demonstration model...")
    params = {
        'objective': 'binary:logistic',
        'eval_metric': 'auc',
        'max_depth': 5,
        'eta': 0.1,
        'seed': 42
    }

    model = xgb.train(params, dtrain, num_boost_round=50)

    # Predict
    preds_train = model.predict(dtrain)
    preds_test = model.predict(dtest)

    auc_in = float(roc_auc_score(y_train, preds_train))
    auc_out = float(roc_auc_score(y_test, preds_test))
    degradation = float(auc_in - auc_out)

    print("\n--- Drift Simulation Results ---")
    print(f"In-Distribution AUC (Age < 40): {auc_in:.4f}")
    print(f"Out-of-Distribution AUC (Age >= 40): {auc_out:.4f}")
    print(f"AUC Degradation: {degradation:.4f}")

    # Save metrics to ml/drift_report.json
    os.makedirs("ml", exist_ok=True)
    report_data = {
        "simulation_type": "Demographic Drift (Age Split)",
        "in_distribution_group": "Age < 40",
        "out_of_distribution_group": "Age >= 40",
        "in_distribution_auc": round(auc_in, 4),
        "out_of_distribution_auc": round(auc_out, 4),
        "auc_degradation": round(degradation, 4),
        "status": "Drift Report Generated Successfully"
    }

    report_path = os.path.join("ml", "drift_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report_data, f, indent=2)

    print(f"Drift report saved to {report_path}")

if __name__ == "__main__":
    run_drift_simulation()
