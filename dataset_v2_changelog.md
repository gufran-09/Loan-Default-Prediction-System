# Dataset v2 Changelog

`Loan_default_v2.csv` is a reproducible, more realistic version of `Loan_default_cleaned.csv`. The original CSV is never modified; the transformation script reads it and writes a separate output file.

## Changes made

- Retained `Age` column for actuarial concentration analysis, demographic fairness auditing, and SR 11-7 model drift monitoring, with 5% realistic missing values (unimputed) reflecting optional disclosures on digital lending channels.
- Reshaped `Income` into a right-skewed log-normal distribution while keeping the original income bounds.
- Reshaped `DTIRatio` with a beta distribution so values concentrate in a realistic middle range and thin toward the upper bound.
- Recalculated `LoanAmount` with correlated income, loan-purpose effects, and random noise. Home loans generally receive larger amounts than auto, personal, education, or other loans.
- Rebalanced the `Education_*`, `EmploymentType_*`, and `LoanPurpose_*` one-hot groups with realistic population skew while preserving one-hot validity.
- Added informative missing values: credit scores are more likely to be missing for borrowers with short employment histories, employment duration is more likely to be missing for self-employed applicants, and income has random missing values. Missing values are not imputed.
- Added `outstanding_balance_ratio`, with defaulted loans receiving a higher range than non-defaulted loans without making the field constant.
- Added `origination_date`, `observation_date`, and `loan_status`. Recent or immature loans remain `Current` even when the original default flag is set.
- Added `days_past_due`, `delinquency_count_12m`, `num_inquiries_6m`, `credit_utilization`, and `prior_defaults` with distributions correlated to default risk.
- Added `collateral_value` for home and auto loans; unsecured purposes receive zero collateral.
- Renamed the original `Default` column to `default_ever` without changing its values.
- Added `default_label`: `1` for `Charged Off`, `0` for `Fully Paid`, and null for `Current`. Rows with a null label must be excluded from model training.

## Reproducibility

`scripts/realistic_dataset_transform.py` uses random seed `42`. Running it again with the same input file and dependencies produces the same transformed values.

## Validation

The script prints row-count preservation, protected-column removal, missingness, loan-status counts, null training-label counts, before/after distribution summaries, balance-ratio variability, and one-hot group checks.