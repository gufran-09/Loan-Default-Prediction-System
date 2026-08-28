# Aegis Risk ML Stakeholder Notes

## Real vs. Simulated Data
During the demo, it is critical that stakeholders understand the origin of our data. 

**What is REAL:**
- The underlying machine learning model is trained on a genuine, structured dataset (`Loan_default_cleaned.csv`). 
- The patterns, feature importances (SHAP values), and mathematical relationships driving the scores are real ML outputs.
- The AUC-ROC metrics represent actual predictive power on the provided dataset.

**What is SIMULATED:**
- Personally Identifiable Information (PII) such as Borrower Names, Email Addresses, and exact Geographic Locations are synthetic. These were generated via the `Faker` library in Python to ensure data privacy during the demo.
- The `seed_borrowers.csv` injected into the backend is a sampling of the dataset with the synthetic identifiers appended.

## Human-Readable Reasons
The SHAP explainability engine surfaces the exact mathematical features that shift the probability of default up or down.

For the credit officers, these are translated into human-readable sentences in the UI. For example:
- **`monthly_income`**: "High monthly income reduces risk."
- **`outstanding_balance`**: "High existing balance increases risk."
- **`tenure_months`**: "Short tenure increases monthly burden."

## Model Drift & Lifecycle
In our drift simulation, we demonstrated what happens if the demographic base shifts (e.g., training on borrowers under 40 and evaluating on borrowers over 40). 

We observed a measurable degradation in AUC. This validates the business case for continuous monitoring and automated retraining pipelines (future Phase: AWS SageMaker deployment).
