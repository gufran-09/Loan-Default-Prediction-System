import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, accuracy_score
import xgboost as xgb

def main():
    print("Loading data for drift simulation...")
    df = pd.read_csv('Loan_default_cleaned.csv')
    
    # ML-05: Model Drift Simulation (Presentation Asset)
    # Let's say we train on younger borrowers (<40) and test on older (>=40)
    # to simulate demographic drift.
    
    df_train = df[df['Age'] < 40]
    df_test = df[df['Age'] >= 40]
    
    print(f"Training set (Age < 40) shape: {df_train.shape}")
    print(f"Testing set (Age >= 40) shape: {df_test.shape}")
    
    X_train = df_train.drop(columns=['Default'])
    y_train = df_train['Default']
    
    X_test = df_test.drop(columns=['Default'])
    y_test = df_test['Default']
    
    # Also evaluate on a random holdout from the <40 group to show baseline performance
    X_train_split, X_val, y_train_split, y_val = train_test_split(
        X_train, y_train, test_size=0.2, random_state=42
    )
    
    print("Training drift demonstration model...")
    scale_pos_weight = (len(y_train_split) - y_train_split.sum()) / y_train_split.sum()
    
    model = xgb.XGBClassifier(
        n_estimators=50,
        max_depth=4,
        learning_rate=0.1,
        scale_pos_weight=scale_pos_weight,
        random_state=42,
        use_label_encoder=False,
        eval_metric='logloss'
    )
    model.fit(X_train_split, y_train_split)
    
    # In-distribution evaluation
    val_preds = model.predict_proba(X_val)[:, 1]
    val_auc = roc_auc_score(y_val, val_preds)
    
    # Out-of-distribution (drift) evaluation
    test_preds = model.predict_proba(X_test)[:, 1]
    test_auc = roc_auc_score(y_test, test_preds)
    
    print("\n--- Drift Simulation Results ---")
    print(f"In-Distribution AUC (Age < 40): {val_auc:.4f}")
    print(f"Out-of-Distribution AUC (Age >= 40): {test_auc:.4f}")
    print(f"AUC Degradation due to demographic drift: {val_auc - test_auc:.4f}")
    
    print("\nSimulation complete. Use these metrics for the presentation.")

if __name__ == "__main__":
    main()
