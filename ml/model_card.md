# Model Card: Aegis Risk XGBoost Production Model (v2.0.0)

## Overview
Production credit default prediction model trained on Dataset v2 (`Loan_default_v2.csv`).
Seasoned loan cohort with unseasoned/immature loans excluded. Missing data natively handled.

## Performance Metrics (Held-out Test Set)
- **AUC-ROC:** 0.7095
- **Baseline (Logistic Regression) AUC-ROC:** 0.7109
- **Scale Pos Weight:** 6.48
- **Features:** 31

## Confusion Matrix (0.5 Decision Boundary)
| | Predicted Non-Default | Predicted Default |
|---|---|---|
| **Actual Non-Default** | 18922 | 10229 |
| **Actual Default** | 1576 | 2925 |

## Compliance & Model Governance (SR 11-7)
- Protected demographic attributes (health status, disability flag) strictly omitted.
- TreeSHAP attribution factor extraction enabled for adverse action notices (CFPB Reg B).
