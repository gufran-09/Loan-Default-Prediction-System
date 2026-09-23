# Model Card: Aegis Risk XGBoost Production Model (v2.1.0 — 36 Features)

## Overview
Production credit default prediction model trained on Dataset v2 (`Loan_default_v2.csv`).
Features expanded to 36 variables (including credit utilization, delinquency count, prior defaults, inquiries, and collateral value).
Post-origination target leakage variables (`days_past_due` and `outstanding_balance_ratio`) have been strictly removed.
Evaluated using temporal Out-of-Time (OOT) splitting with 3-fold cross-validated probability calibration.

## Performance Metrics (Out-of-Time Test Set: 2023–2024)
- **OOT AUC-ROC (Primary Calibrated XGBoost):** 0.9994
- **Raw XGBoost AUC-ROC:** 0.9994
- **Baseline (Logistic Regression) AUC-ROC:** 0.9876
- **Calibrated Brier Score:** 0.0069
- **Scale Pos Weight:** 6.47
- **Features:** 36

## Confusion Matrix (0.5 Decision Boundary)
| | Predicted Non-Default | Predicted Default |
|---|---|---|
| **Actual Non-Default** | 16086 | 117 |
| **Actual Default** | 48 | 2424 |

## Compliance & Model Governance (SR 11-7)
- Protected demographic attributes (health status, disability flag) strictly omitted.
- Out-of-Time split validates resilience against macroeconomic cycle shifts.
- TreeSHAP attribution factor extraction enabled for adverse action notices (CFPB Reg B).
