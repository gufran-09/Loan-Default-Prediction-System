-- Migration 0005: Behavioral & Alternative Data (Supabase Backup)
-- Backup copy of scripts/migrations/0005_behavioral_alternative_data.sql

-- Alternative credit data table
CREATE TABLE IF NOT EXISTS alternative_credit_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES borrowers(id) ON DELETE CASCADE,
  data_type TEXT NOT NULL CHECK (data_type IN (
    'utility_payment', 'rent_payment', 'telecom_payment', 'micro_transaction'
  )),
  provider_name TEXT,
  months_of_history INTEGER DEFAULT 0,
  on_time_payment_rate NUMERIC DEFAULT 0,
  average_monthly_amount NUMERIC DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE alternative_credit_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_alt_credit" ON alternative_credit_data
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_alt_credit" ON alternative_credit_data
  FOR INSERT TO authenticated WITH CHECK (true);

-- Derived alternative credit score on borrower
ALTER TABLE borrowers
  ADD COLUMN IF NOT EXISTS alternative_credit_score NUMERIC DEFAULT NULL;

-- Application session telemetry (fraud detection behavioral markers)
CREATE TABLE IF NOT EXISTS session_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID REFERENCES borrowers(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  form_start_time TIMESTAMP WITH TIME ZONE,
  form_submit_time TIMESTAMP WITH TIME ZONE,
  total_fill_duration_seconds INTEGER,
  field_revision_count INTEGER DEFAULT 0,
  copy_paste_detected BOOLEAN DEFAULT FALSE,
  inconsistency_flags JSONB DEFAULT '[]',
  device_fingerprint TEXT,
  ip_geo_location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE session_telemetry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_telemetry" ON session_telemetry
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_telemetry" ON session_telemetry
  FOR INSERT TO authenticated WITH CHECK (true);
