import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, precision_recall_curve, confusion_matrix
import xgboost as xgb
import json
import os
import pickle

def main():
    print("Loading data...")
    df = pd.read_csv('Loan_default_cleaned.csv')
    
    # ML-01: Explore and Split
    print(f"Dataset shape: {df.shape}")
    X = df.drop(columns=['Default'])
    y = df['Default']
    
    # 80/20 Stratified Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )
    
    print(f"Positive rate in train: {y_train.mean():.4f}")
    print(f"Positive rate in test: {y_test.mean():.4f}")
    
    # ML-02: Baseline & Primary Model Training
    print("Training Logistic Regression baseline...")
    lr_model = LogisticRegression(max_iter=1000)
    lr_model.fit(X_train, y_train)
    lr_preds = lr_model.predict_proba(X_test)[:, 1]
    lr_auc = roc_auc_score(y_test, lr_preds)
    print(f"Logistic Regression AUC: {lr_auc:.4f}")
    
    print("Training XGBoost primary model...")
    # scale_pos_weight = negative_class / positive_class
    neg_class_count = len(y_train) - y_train.sum()
    pos_class_count = y_train.sum()
    scale_pos_weight = neg_class_count / pos_class_count
    print(f"Using scale_pos_weight = {scale_pos_weight:.2f}")
    
    xgb_model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        scale_pos_weight=scale_pos_weight,
        random_state=42,
        use_label_encoder=False,
        eval_metric='logloss'
    )
    xgb_model.fit(X_train, y_train)
    
    # ML-03: Model Evaluation
    xgb_preds = xgb_model.predict_proba(X_test)[:, 1]
    xgb_auc = roc_auc_score(y_test, xgb_preds)
    print(f"XGBoost AUC: {xgb_auc:.4f}")
    
    # Confusion Matrix
    y_pred_class = (xgb_preds > 0.5).astype(int)
    cm = confusion_matrix(y_test, y_pred_class)
    
    # Create ml folder
    os.makedirs('ml', exist_ok=True)
    
    # Generate model_card.md
    with open('ml/model_card.md', 'w') as f:
        f.write("# Model Card: XGBoost Loan Default Prediction\n\n")
        f.write("## Overview\n")
        f.write("Primary model for predicting loan defaults based on 31 features.\n\n")
        f.write("## Metrics (Test Set)\n")
        f.write(f"- **AUC-ROC:** {xgb_auc:.4f}\n")
        f.write(f"- **Baseline (LogReg) AUC-ROC:** {lr_auc:.4f}\n\n")
        f.write("## Confusion Matrix (Threshold = 0.5)\n")
        f.write("| | Predicted Non-Default | Predicted Default |\n")
        f.write("|---|---|---|\n")
        f.write(f"| **Actual Non-Default** | {cm[0,0]} | {cm[0,1]} |\n")
        f.write(f"| **Actual Default** | {cm[1,0]} | {cm[1,1]} |\n\n")
        f.write("## Limitations\n")
        f.write("The model handles class imbalance using `scale_pos_weight`. False positives are elevated to ensure high recall for defaults.\n")
    
    # ML-06: Artifact Serialization
    print("Serializing artifacts...")
    with open('ml/model.pkl', 'wb') as f:
        pickle.dump(xgb_model, f)
        
    with open('ml/feature_columns.json', 'w') as f:
        json.dump(list(X.columns), f)
        
    print("Training complete and artifacts saved.")

if __name__ == "__main__":
    main()
