# Model Card: XGBoost Loan Default Prediction

## Overview
Primary model for predicting loan defaults based on 31 features.

## Metrics (Test Set)
- **AUC-ROC:** 0.7576
- **Baseline (LogReg) AUC-ROC:** 0.7491

## Confusion Matrix (Threshold = 0.5)
| | Predicted Non-Default | Predicted Default |
|---|---|---|
| **Actual Non-Default** | 31184 | 13955 |
| **Actual Default** | 1862 | 4069 |

## Limitations
The model handles class imbalance using `scale_pos_weight`. False positives are elevated to ensure high recall for defaults.
