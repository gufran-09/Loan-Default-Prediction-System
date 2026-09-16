-- Migration 0006: Scoring History & Explainability Artifacts
-- Primary target: Amazon RDS PostgreSQL (aegis-risk-db)

-- Scoring history for trend analysis & continuous learning
CREATE TABLE IF NOT EXISTS scoring_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES borrowers(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL,
  bucket TEXT NOT NULL,
  model_version TEXT NOT NULL,
  scoring_method TEXT NOT NULL DEFAULT 'batch'
    CHECK (scoring_method IN ('batch', 'realtime', 'rescore', 'what_if')),
  feature_snapshot JSONB,
  shap_values JSONB,
  scored_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Extend risk_scores with explainability artifacts
ALTER TABLE risk_scores
  ADD COLUMN IF NOT EXISTS feature_importances JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS shap_values JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lime_explanation JSONB DEFAULT NULL;
