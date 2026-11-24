"""
Loan Sentry — Multi-Model ML Benchmark Suite (PyCaret Architecture)
Evaluates candidate classifiers on the 36-feature loan default dataset
using Out-of-Time (OOT) validation and metrics matching PyCaret compare_models().
"""

import os
import sys
import json
import time
import pandas as pd
import numpy as np

from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import (
    RandomForestClassifier,
    ExtraTreesClassifier,
    GradientBoostingClassifier,
    AdaBoostClassifier,
)
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier
from sklearn.dummy import DummyClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    roc_auc_score,
    accuracy_score,
    recall_score,
    precision_score,
    f1_score,
    cohen_kappa_score,
    matthews_corrcoef,
    brier_score_loss,
)

# Optional advanced gradient boosters
try:
    from xgboost import XGBClassifier
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False

try:
    from lightgbm import LGBMClassifier
    HAS_LIGHTGBM = True
except ImportError:
    HAS_LIGHTGBM = False

try:
    from catboost import CatBoostClassifier
    HAS_CATBOOST = True
except ImportError:
    HAS_CATBOOST = False


def find_dataset(filename="Loan_default_v2.csv"):
    candidates = [
        os.path.join("data", filename),
        filename,
        os.path.join("..", "data", filename),
        os.path.join(os.path.dirname(__file__), "..", "data", filename),
        os.path.join(os.path.dirname(__file__), "..", filename),
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    raise FileNotFoundError(f"Dataset {filename} not found.")


def load_feature_columns():
    col_path = os.path.join("ml", "feature_columns.json")
    if os.path.exists(col_path):
        with open(col_path, "r") as f:
            return json.load(f)
    raise FileNotFoundError("ml/feature_columns.json not found.")


def main():
    print("================================================================================")
    print("  LOAN SENTRY — MULTI-MODEL BENCHMARK SUITE (PYCARET ARCHITECTURE)             ")
    print("================================================================================")

    data_path = find_dataset("Loan_default_v2.csv")
    print(f"Loading dataset from: {data_path}")
    df = pd.read_csv(data_path)

    # 1. Filter mature/seasoned loans
    seasoned_mask = df["default_label"].notna()
    df_seasoned = df[seasoned_mask].copy()
    print(f"Total records: {len(df):,} | Seasoned cohort: {len(df_seasoned):,}")

    feature_cols = load_feature_columns()
    print(f"Features: {len(feature_cols)} credit origination variables")

    # 2. Out-of-Time split
    if "origination_date" in df_seasoned.columns:
        df_seasoned["orig_dt"] = pd.to_datetime(df_seasoned["origination_date"])
        train_mask = df_seasoned["orig_dt"] <= pd.to_datetime("2022-12-31")
        test_mask = df_seasoned["orig_dt"] > pd.to_datetime("2022-12-31")
    else:
        # Fallback to temporal 70/30 split
        n = len(df_seasoned)
        train_mask = np.arange(n) < int(n * 0.70)
        test_mask = ~train_mask

    # For fast multi-model comparison across 12+ algorithms, draw a stratified sample
    # if dataset exceeds 30,000 to ensure fast execution while maintaining distributional fidelity
    from sklearn.model_selection import train_test_split

    sample_size = min(30000, len(df_seasoned))
    print(f"Stratified benchmarking sample size: {sample_size:,} records")
    sample_df, _ = train_test_split(
        df_seasoned,
        train_size=sample_size,
        stratify=df_seasoned["default_label"],
        random_state=42,
    )

    X = sample_df[feature_cols].copy()
    y = sample_df["default_label"].astype(int).values

    # Impute missing
    imputer = SimpleImputer(strategy="median")
    X_imputed = imputer.fit_transform(X)

    # Re-apply temporal split on sample
    if "orig_dt" in sample_df.columns:
        train_idx = sample_df["orig_dt"] <= pd.to_datetime("2022-12-31")
        test_idx = sample_df["orig_dt"] > pd.to_datetime("2022-12-31")
        X_train, y_train = X_imputed[train_idx], y[train_idx]
        X_test, y_test = X_imputed[test_idx], y[test_idx]
    else:
        split_pt = int(len(X_imputed) * 0.7)
        X_train, y_train = X_imputed[:split_pt], y[:split_pt]
        X_test, y_test = X_imputed[split_pt:], y[split_pt:]

    print(f"Train split: {len(X_train):,} samples | Test split (OOT): {len(X_test):,} samples")
    default_rate = np.mean(y_test) * 100
    print(f"Test Default Rate: {default_rate:.2f}% (Class Imbalance ~ {100/default_rate - 1:.1f} : 1)\n")

    # Define Candidate Models (PyCaret Classifier Model Catalog)
    pos_weight = (len(y_train) - np.sum(y_train)) / np.sum(y_train)

    models = {}

    if HAS_XGBOOST:
        models["xgboost"] = (
            "Extreme Gradient Boosting",
            XGBClassifier(
                n_estimators=100,
                max_depth=4,
                learning_rate=0.1,
                scale_pos_weight=pos_weight,
                random_state=42,
                eval_metric="logloss",
                n_jobs=-1,
            ),
        )

    if HAS_LIGHTGBM:
        models["lightgbm"] = (
            "Light Gradient Boosting Machine",
            LGBMClassifier(
                n_estimators=100,
                max_depth=4,
                learning_rate=0.1,
                scale_pos_weight=pos_weight,
                random_state=42,
                verbosity=-1,
                n_jobs=-1,
            ),
        )

    if HAS_CATBOOST:
        models["catboost"] = (
            "CatBoost Classifier",
            CatBoostClassifier(
                iterations=100,
                depth=4,
                learning_rate=0.1,
                scale_pos_weight=pos_weight,
                random_seed=42,
                verbose=0,
                thread_count=-1,
            ),
        )

    models["rf"] = (
        "Random Forest Classifier",
        RandomForestClassifier(
            n_estimators=100,
            max_depth=8,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        ),
    )

    models["et"] = (
        "Extra Trees Classifier",
        ExtraTreesClassifier(
            n_estimators=100,
            max_depth=8,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        ),
    )

    models["gbc"] = (
        "Gradient Boosting Classifier",
        GradientBoostingClassifier(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.1,
            random_state=42,
        ),
    )

    models["ada"] = (
        "AdaBoost Classifier",
        AdaBoostClassifier(
            n_estimators=50,
            learning_rate=0.1,
            random_state=42,
        ),
    )

    models["lr"] = (
        "Logistic Regression",
        LogisticRegression(
            max_iter=1000,
            class_weight="balanced",
            random_state=42,
        ),
    )

    models["dt"] = (
        "Decision Tree Classifier",
        DecisionTreeClassifier(
            max_depth=6,
            class_weight="balanced",
            random_state=42,
        ),
    )

    models["lda"] = (
        "Linear Discriminant Analysis",
        LinearDiscriminantAnalysis(),
    )

    models["nb"] = (
        "Gaussian Naive Bayes",
        GaussianNB(),
    )

    models["knn"] = (
        "K-Nearest Neighbors",
        KNeighborsClassifier(
            n_neighbors=5,
            n_jobs=-1,
        ),
    )

    models["dummy"] = (
        "Dummy Classifier",
        DummyClassifier(strategy="stratified", random_state=42),
    )

    print(f"Beginning multi-model evaluation across {len(models)} algorithms...\n")

    results = []

    for model_id, (model_name, clf) in models.items():
        t0 = time.time()
        try:
            clf.fit(X_train, y_train)
            train_time = time.time() - t0

            # Predict probabilities and classes
            if hasattr(clf, "predict_proba"):
                y_prob = clf.predict_proba(X_test)[:, 1]
            elif hasattr(clf, "decision_function"):
                df_val = clf.decision_function(X_test)
                y_prob = 1 / (1 + np.exp(-df_val))
            else:
                y_prob = clf.predict(X_test).astype(float)

            y_pred = (y_prob >= 0.5).astype(int)

            # Calculate PyCaret metrics
            auc = roc_auc_score(y_test, y_prob)
            acc = accuracy_score(y_test, y_pred)
            rec = recall_score(y_test, y_pred, zero_division=0)
            prec = precision_score(y_test, y_pred, zero_division=0)
            f1 = f1_score(y_test, y_pred, zero_division=0)
            kappa = cohen_kappa_score(y_test, y_pred)
            mcc = matthews_corrcoef(y_test, y_pred)
            brier = brier_score_loss(y_test, y_prob)

            results.append({
                "model_id": model_id,
                "model_name": model_name,
                "auc": round(float(auc), 4),
                "accuracy": round(float(acc), 4),
                "recall": round(float(rec), 4),
                "precision": round(float(prec), 4),
                "f1": round(float(f1), 4),
                "kappa": round(float(kappa), 4),
                "mcc": round(float(mcc), 4),
                "brier": round(float(brier), 4),
                "tt_sec": round(float(train_time), 3),
            })
            print(f"  [✓] {model_name:<34} | AUC: {auc:.4f} | Recall: {rec:.4f} | Prec: {prec:.4f} | Time: {train_time:.2f}s")
        except Exception as e:
            print(f"  [✗] {model_name:<34} | FAILED: {e}")

    # Sort results by AUC descending (PyCaret default ranking for imbalanced classification)
    results_sorted = sorted(results, key=lambda x: x["auc"], reverse=True)

    print("\n" + "=" * 105)
    print("                                PYCARET MODEL LEADERBOARD (SORTED BY AUC)")
    print("=" * 105)
    header = f"{'Model ID':<10} | {'Model Name':<32} | {'AUC':<7} | {'Accuracy':<8} | {'Recall':<7} | {'Prec.':<7} | {'F1':<7} | {'Kappa':<7} | {'MCC':<7} | {'TT (s)':<6}"
    print(header)
    print("-" * 105)
    for r in results_sorted:
        row = (
            f"{r['model_id']:<10} | "
            f"{r['model_name']:<32} | "
            f"{r['auc']:<7.4f} | "
            f"{r['accuracy']:<8.4f} | "
            f"{r['recall']:<7.4f} | "
            f"{r['precision']:<7.4f} | "
            f"{r['f1']:<7.4f} | "
            f"{r['kappa']:<7.4f} | "
            f"{r['mcc']:<7.4f} | "
            f"{r['tt_sec']:<6.2f}"
        )
        print(row)
    print("=" * 105)

    # Save to JSON
    out_path = os.path.join("ml", "model_benchmark_results.json")
    with open(out_path, "w") as f:
        json.dump({
            "benchmark_dataset": "data/Loan_default_v2.csv",
            "sample_records": sample_size,
            "train_samples": len(X_train),
            "test_samples": len(X_test),
            "feature_count": len(feature_cols),
            "ranking_metric": "AUC",
            "models_evaluated": len(results_sorted),
            "leaderboard": results_sorted,
        }, f, indent=2)

    print(f"\nLeaderboard successfully exported to: {out_path}")


if __name__ == "__main__":
    main()
