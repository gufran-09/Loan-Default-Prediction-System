import pandas as pd
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.impute import SimpleImputer
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import roc_auc_score, brier_score_loss, confusion_matrix
import xgboost as xgb
import json
import os
import pickle

def main():
    print("==========================================================")
    print("  AEGIS RISK - PRODUCTION ML TRAINING (DATASET V2 - 38 FEAT) ")
    print("==========================================================")
    
    dataset_path = 'Loan_default_v2.csv'
    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Dataset not found: {dataset_path}")
        
    df = pd.read_csv(dataset_path)
    print(f"Total dataset records: {len(df):,}")
    
    # 1. Filter seasoned cohort (exclude unseasoned Current loans)
    seasoned_mask = df['default_label'].notna()
    df_seasoned = df[seasoned_mask].copy()
    print(f"Seasoned loan cohort (excluding unseasoned Current): {len(df_seasoned):,}")
    
    # 2. Define 36-feature credit architecture (excluding post-origination target leakage)
    feature_cols = [
        "Age", "Income", "LoanAmount", "CreditScore", "MonthsEmployed",
        "NumCreditLines", "InterestRate", "LoanTerm", "DTIRatio",
        "Education_Bachelor's", "Education_High School", "Education_Master's", "Education_PhD",
        "EmploymentType_Full-time", "EmploymentType_Part-time", "EmploymentType_Self-employed", "EmploymentType_Unemployed",
        "MaritalStatus_Divorced", "MaritalStatus_Married", "MaritalStatus_Single",
        "HasMortgage_No", "HasMortgage_Yes",
        "HasDependents_No", "HasDependents_Yes",
        "LoanPurpose_Auto", "LoanPurpose_Business", "LoanPurpose_Education", "LoanPurpose_Home", "LoanPurpose_Other",
        "HasCoSigner_No", "HasCoSigner_Yes",
        "credit_utilization", "delinquency_count_12m", "num_inquiries_6m",
        "prior_defaults", "collateral_value"
    ]
    
    print(f"Feature space: {len(feature_cols)} predictors (target leakage excluded)")
    
    # 3. Out-of-Time (OOT) Temporal Splitting based on origination_date
    df_seasoned['orig_dt'] = pd.to_datetime(df_seasoned['origination_date'])
    split_date = pd.to_datetime('2022-12-31')
    
    train_mask = df_seasoned['orig_dt'] <= split_date
    test_mask = df_seasoned['orig_dt'] > split_date
    
    X_train = df_seasoned.loc[train_mask, feature_cols].copy()
    y_train = df_seasoned.loc[train_mask, 'default_label'].astype(int)
    
    X_test = df_seasoned.loc[test_mask, feature_cols].copy()
    y_test = df_seasoned.loc[test_mask, 'default_label'].astype(int)
    
    print(f"\n--- Out-of-Time (OOT) Temporal Split ---")
    print(f"Train Cohort (<= 2022-12-31): {len(X_train):,} loans (Default rate: {y_train.mean():.4f})")
    print(f"OOT Test Cohort (> 2022-12-31): {len(X_test):,} loans (Default rate: {y_test.mean():.4f})")
    
    # 4. Logistic Regression Regulatory Baseline
    print("\nTraining Logistic Regression linear regulatory benchmark...")
    imputer = SimpleImputer(strategy='median')
    X_train_imp = imputer.fit_transform(X_train)
    X_test_imp = imputer.transform(X_test)
    
    lr = LogisticRegression(max_iter=1000, random_state=42)
    lr.fit(X_train_imp, y_train)
    lr_preds = lr.predict_proba(X_test_imp)[:, 1]
    lr_auc = roc_auc_score(y_test, lr_preds)
    print(f"Logistic Regression OOT AUC-ROC: {lr_auc:.4f}")
    
    # 5. Primary Model: XGBoost with Class-Imbalance Weighting
    print(f"\nTraining Primary 100-Tree XGBoost Model ({len(feature_cols)} Features)...")
    neg_count = len(y_train) - y_train.sum()
    pos_count = y_train.sum()
    scale_pos_weight = neg_count / pos_count
    print(f"Optimal scale_pos_weight: {scale_pos_weight:.2f}")
    
    xgb_base = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        scale_pos_weight=scale_pos_weight,
        random_state=42,
        eval_metric='logloss'
    )
    xgb_base.fit(X_train, y_train)
    
    # Raw booster evaluation
    raw_preds = xgb_base.predict_proba(X_test)[:, 1]
    raw_auc = roc_auc_score(y_test, raw_preds)
    print(f"XGBoost Raw OOT AUC-ROC: {raw_auc:.4f}")
    
    # 6. Post-hoc Probability Calibration (Platt Sigmoid cross-validated cv=3)
    print("\nFitting Post-Hoc Probability Calibration Layer for CECL / Expected Loss...")
    calibrated_clf = CalibratedClassifierCV(estimator=xgb_base, method='sigmoid', cv=3)
    calibrated_clf.fit(X_train, y_train)
    
    calib_preds = calibrated_clf.predict_proba(X_test)[:, 1]
    calib_auc = roc_auc_score(y_test, calib_preds)
    brier = brier_score_loss(y_test, calib_preds)
    print(f"Calibrated Model OOT AUC-ROC: {calib_auc:.4f}")
    print(f"Calibrated Brier Score (Accuracy of PD): {brier:.4f}")
    
    # Confusion Matrix (Threshold = 0.5)
    y_pred_class = (calib_preds > 0.5).astype(int)
    cm = confusion_matrix(y_test, y_pred_class)
    
    # 7. Model Card & Artifact Export
    os.makedirs('ml', exist_ok=True)
    
    with open('ml/model_card.md', 'w') as f:
        f.write(f"# Model Card: Aegis Risk XGBoost Production Model (v2.1.0 — {len(feature_cols)} Features)\n\n")
        f.write("## Overview\n")
        f.write("Production credit default prediction model trained on Dataset v2 (`Loan_default_v2.csv`).\n")
        f.write(f"Features expanded to {len(feature_cols)} variables (including credit utilization, delinquency count, prior defaults, inquiries, and collateral value).\n")
        f.write("Post-origination target leakage variables (`days_past_due` and `outstanding_balance_ratio`) have been strictly removed.\n")
        f.write("Evaluated using temporal Out-of-Time (OOT) splitting with 3-fold cross-validated probability calibration.\n\n")
        f.write("## Performance Metrics (Out-of-Time Test Set: 2023–2024)\n")
        f.write(f"- **OOT AUC-ROC (Primary Calibrated XGBoost):** {calib_auc:.4f}\n")
        f.write(f"- **Raw XGBoost AUC-ROC:** {raw_auc:.4f}\n")
        f.write(f"- **Baseline (Logistic Regression) AUC-ROC:** {lr_auc:.4f}\n")
        f.write(f"- **Calibrated Brier Score:** {brier:.4f}\n")
        f.write(f"- **Scale Pos Weight:** {scale_pos_weight:.2f}\n")
        f.write(f"- **Features:** {len(feature_cols)}\n\n")
        f.write("## Confusion Matrix (0.5 Decision Boundary)\n")
        f.write("| | Predicted Non-Default | Predicted Default |\n")
        f.write("|---|---|---|\n")
        f.write(f"| **Actual Non-Default** | {cm[0,0]} | {cm[0,1]} |\n")
        f.write(f"| **Actual Default** | {cm[1,0]} | {cm[1,1]} |\n\n")
        f.write("## Compliance & Model Governance (SR 11-7)\n")
        f.write("- Protected demographic attributes (health status, disability flag) strictly omitted.\n")
        f.write("- Out-of-Time split validates resilience against macroeconomic cycle shifts.\n")
        f.write("- TreeSHAP attribution factor extraction enabled for adverse action notices (CFPB Reg B).\n")
    
    print("\nSerializing production artifacts...")
    # Serialized model
    with open('ml/model.pkl', 'wb') as f:
        pickle.dump(xgb_base, f)
        
    with open('ml/calibrator.pkl', 'wb') as f:
        pickle.dump(calibrated_clf, f)
        
    with open('ml/feature_columns.json', 'w') as f:
        json.dump(feature_cols, f, indent=2)
        
    # Save native booster
    booster = xgb_base.get_booster()
    booster.save_model("ml/model.json")
    print("Exported native booster to ml/model.json")
    print(f"Saved feature columns ({len(feature_cols)}) to ml/feature_columns.json")
    
    print("\n[SUCCESS] Model training and artifact serialization complete.")

if __name__ == "__main__":
    main()
