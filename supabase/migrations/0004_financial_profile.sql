-- Migration 0004: Financial & Credit Profile Enhancement (Supabase Backup)
-- Backup copy of scripts/migrations/0004_financial_profile.sql

-- Granular debt obligations
ALTER TABLE borrowers
  ADD COLUMN IF NOT EXISTS existing_credit_card_debt NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS existing_auto_loans NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS existing_personal_loans NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alimony_obligations NUMERIC DEFAULT 0;

-- Asset & Collateral profiling
ALTER TABLE borrowers
  ADD COLUMN IF NOT EXISTS real_estate_value NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS liquid_savings NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS investment_portfolio_value NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS collateral_type TEXT DEFAULT 'none'
    CHECK (collateral_type IN ('none', 'real_estate', 'vehicle', 'securities', 'other')),
  ADD COLUMN IF NOT EXISTS collateral_value NUMERIC DEFAULT 0;

-- Income verification & stability
ALTER TABLE borrowers
  ADD COLUMN IF NOT EXISTS income_source TEXT DEFAULT 'wages'
    CHECK (income_source IN ('wages', 'self_employment', 'investments', 'rental', 'pension', 'mixed')),
  ADD COLUMN IF NOT EXISTS income_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS months_at_current_job INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS income_consistency_score NUMERIC DEFAULT 0.5;
