-- Migration 0007: Core Model Input Features for Borrower Underwriting
-- Adds key SHAP drivers and one-hot categorical features matching ml/feature_columns.json

ALTER TABLE borrowers
  ADD COLUMN IF NOT EXISTS months_employed INTEGER DEFAULT 24,
  ADD COLUMN IF NOT EXISTS num_credit_lines INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS interest_rate NUMERIC DEFAULT 10.5,
  ADD COLUMN IF NOT EXISTS education TEXT DEFAULT 'Bachelor''s',
  ADD COLUMN IF NOT EXISTS has_mortgage BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_dependents BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_cosigner BOOLEAN DEFAULT FALSE;
