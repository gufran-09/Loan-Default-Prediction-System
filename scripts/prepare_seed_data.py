import pandas as pd
import numpy as np
import pickle
import json
import shap
from faker import Faker
import os

def generate_uuid():
    import uuid
    return str(uuid.uuid4())

def main():
    print("Loading model and feature columns...")
    with open('ml/model.pkl', 'rb') as f:
        model = pickle.load(f)
    with open('ml/feature_columns.json', 'r') as f:
        feature_columns = json.load(f)
        
    print("Loading dataset...")
    df = pd.read_csv('Loan_default_cleaned.csv')
    
    # ML-07: Sample 400 rows
    df_sample = df.sample(n=400, random_state=42).reset_index(drop=True)
    X_sample = df_sample[feature_columns]
    
    print("Calculating SHAP values...")
    # ML-04: SHAP Explainability
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_sample)
    
    # Generate predictions
    preds = model.predict_proba(X_sample)[:, 1]
    
    faker = Faker()
    Faker.seed(42)
    
    borrowers_records = []
    scores_reasons_records = []
    
    print("Processing synthetic data and explanations...")
    for i in range(len(df_sample)):
        borrower_id = generate_uuid()
        score_id = generate_uuid()
        
        # Reverse one-hot for geography (mocking it since geography wasn't one-hot in the sample, wait, let me check features)
        # Actually in the head we saw: Education_..., EmploymentType_..., MaritalStatus_..., HasMortgage_..., HasDependents_..., LoanPurpose_..., HasCoSigner_...
        # Let's derive geography synthetically.
        geography = np.random.choice(['North America', 'Europe', 'Asia', 'South America', 'Africa'])
        
        # Derive EmploymentType
        emp_type = 'Salaried'
        if df_sample.loc[i, 'EmploymentType_Self-employed'] == 1:
            emp_type = 'Self-Employed'
        elif df_sample.loc[i, 'EmploymentType_Part-time'] == 1:
            emp_type = 'Part-time'
        elif df_sample.loc[i, 'EmploymentType_Unemployed'] == 1:
            emp_type = 'Unemployed'
        
        # Derive LoanPurpose
        loan_purpose = 'Other'
        if df_sample.loc[i, 'LoanPurpose_Auto'] == 1:
            loan_purpose = 'Auto'
        elif df_sample.loc[i, 'LoanPurpose_Business'] == 1:
            loan_purpose = 'Business'
        elif df_sample.loc[i, 'LoanPurpose_Education'] == 1:
            loan_purpose = 'Education'
        elif df_sample.loc[i, 'LoanPurpose_Home'] == 1:
            loan_purpose = 'Home'
            
        borrowers_records.append({
            'id': borrower_id,
            'name': faker.name(),
            'email': faker.unique.email(),
            'geography': geography,
            'employment_type': emp_type,
            'loan_purpose': loan_purpose,
            'loan_amount': df_sample.loc[i, 'LoanAmount'],
            'monthly_income': df_sample.loc[i, 'Income'] / 12 if 'Income' in df_sample.columns else df_sample.loc[i, 'monthly_income'],
            'outstanding_balance': df_sample.loc[i, 'LoanAmount'] * 0.8, # Derived
            'tenure_months': df_sample.loc[i, 'LoanTerm']
        })
        
        # ML-08: Risk Buckets
        prob = preds[i]
        if prob < 0.3:
            bucket = 'low'
        elif prob < 0.6:
            bucket = 'medium'
        elif prob < 0.85:
            bucket = 'high'
        else:
            bucket = 'critical'
            
        # Top 3 features by absolute SHAP value
        row_shap = shap_values[i, :]
        top_indices = np.argsort(np.abs(row_shap))[-3:][::-1]
        
        for rank, idx in enumerate(top_indices):
            impact_mag = abs(row_shap[idx])
            impact_dir = '+' if row_shap[idx] > 0 else '-'
            feature_name = feature_columns[idx]
            
            desc = f"Impact of {feature_name} is {'increasing' if impact_dir == '+' else 'decreasing'} risk."
            
            scores_reasons_records.append({
                'score_id': score_id,
                'borrower_id': borrower_id,
                'score': prob,
                'bucket': bucket,
                'model_version': 'v1.0',
                'feature_name': feature_name,
                'impact_magnitude': impact_mag,
                'impact_direction': impact_dir,
                'description': desc
            })

    # Export to CSV
    borrowers_df = pd.DataFrame(borrowers_records)
    borrowers_df.to_csv('seed_borrowers.csv', index=False)
    
    scores_reasons_df = pd.DataFrame(scores_reasons_records)
    scores_reasons_df.to_csv('seed_scores_reasons.csv', index=False)
    
    print("Successfully exported seed_borrowers.csv and seed_scores_reasons.csv")

if __name__ == "__main__":
    main()
