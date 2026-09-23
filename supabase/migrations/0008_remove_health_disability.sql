-- Migration 0008: Remove Prohibited Health & Disability Underwriting Attributes
-- Reason: ECOA / Fair Lending compliance - health and disability status must never appear in credit underwriting.

ALTER TABLE borrowers
  DROP COLUMN IF EXISTS health_status,
  DROP COLUMN IF EXISTS disability_flag;
