import pickle
import json
import xgboost as xgb
import numpy as np

def main():
    print("Loading ml/model.pkl...")
    with open("ml/model.pkl", "rb") as f:
        model = pickle.load(f)
    print("Model type:", type(model))

    booster = model.get_booster()
    print("Booster feature names count:", len(booster.feature_names) if booster.feature_names else "none")

    # Save to native XGBoost JSON
    booster.save_model("ml/model.json")
    print("Saved native XGBoost booster to ml/model.json successfully.")

    with open("ml/feature_columns.json", "r") as f:
        feature_cols = json.load(f)
    print(f"Feature columns ({len(feature_cols)}):", feature_cols)

    # Test prediction on dummy zero vector
    x_test = np.zeros((1, len(feature_cols)))
    pred_prob = model.predict_proba(x_test)[0, 1]
    print(f"Sample prediction probability on zeros: {pred_prob:.4f}")

if __name__ == "__main__":
    main()
