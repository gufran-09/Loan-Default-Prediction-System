-- Migration 0003: Applicant Demographic & Personal Data
-- Primary target: Amazon RDS PostgreSQL (aegis-risk-db)
-- Adds age, health, dependents, and marital status to borrowers

ALTER TABLE borrowers
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS health_status TEXT DEFAULT 'healthy'
    CHECK (health_status IN ('healthy', 'chronic_condition', 'disability')),
  ADD COLUMN IF NOT EXISTS disability_flag BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS num_dependents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS marital_status TEXT DEFAULT 'single'
    CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed'));
