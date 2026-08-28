# Model Card: XGBoost Loan Default Prediction

## Overview
Primary model for predicting loan defaults based on 31 features.

## Metrics (Test Set)
- **AUC-ROC:** 0.7581
- **Baseline (LogReg) AUC-ROC:** 0.7491

## Confusion Matrix (Threshold = 0.5)
| | Predicted Non-Default | Predicted Default |
|---|---|---|
| **Actual Non-Default** | 31265 | 13874 |
| **Actual Default** | 1861 | 4070 |

## Limitations
The model handles class imbalance using `scale_pos_weight`. False positives are elevated to ensure high recall for defaults.
