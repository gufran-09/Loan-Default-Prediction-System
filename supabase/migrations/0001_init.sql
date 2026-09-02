-- Aegis Risk Core Schema Migration
-- Matches lib/types/index.ts and AEGIS_RISK_IMPLEMENTATION_GUIDE.md

-- 1. Create borrowers table
CREATE TABLE IF NOT EXISTS borrowers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  loan_type TEXT NOT NULL,
  loan_amount NUMERIC NOT NULL,
  outstanding_balance NUMERIC NOT NULL,
  geography TEXT NOT NULL,
  tenure_months INTEGER NOT NULL,
  monthly_income NUMERIC NOT NULL,
  employment_status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create risk_scores table
CREATE TABLE IF NOT EXISTS risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES borrowers(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL,
  bucket TEXT NOT NULL CHECK (bucket IN ('low', 'medium', 'high', 'critical')),
  model_version TEXT NOT NULL,
  scored_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create risk_reasons table
CREATE TABLE IF NOT EXISTS risk_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_score_id UUID NOT NULL REFERENCES risk_scores(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  feature TEXT NOT NULL,
  impact NUMERIC NOT NULL,
  rank INTEGER NOT NULL
);

-- 4. Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES borrowers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- 6. Read policies for authenticated users
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_read_borrowers') THEN
    CREATE POLICY "authenticated_read_borrowers" ON borrowers FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_read_risk_scores') THEN
    CREATE POLICY "authenticated_read_risk_scores" ON risk_scores FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_read_risk_reasons') THEN
    CREATE POLICY "authenticated_read_risk_reasons" ON risk_reasons FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_read_alerts') THEN
    CREATE POLICY "authenticated_read_alerts" ON alerts FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- 7. Update policies for authenticated users (e.g. marking alerts acknowledged/resolved)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_update_alerts') THEN
    CREATE POLICY "authenticated_update_alerts" ON alerts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 8. Trigger function to auto-generate alerts when risk score is high or critical
CREATE OR REPLACE FUNCTION generate_risk_alert()
RETURNS TRIGGER AS $$
DECLARE
  v_borrower_name TEXT;
  v_external_id TEXT;
BEGIN
  IF NEW.bucket IN ('high', 'critical') THEN
    SELECT full_name, external_id INTO v_borrower_name, v_external_id
    FROM borrowers WHERE id = NEW.borrower_id;

    INSERT INTO alerts (borrower_id, title, description, severity, status)
    VALUES (
      NEW.borrower_id,
      CASE 
        WHEN NEW.bucket = 'critical' THEN 'Critical Default Risk Detected'
        ELSE 'High Risk Borrower Warning'
      END,
      'Borrower ' || COALESCE(v_borrower_name, 'Unknown') || ' (' || COALESCE(v_external_id, 'N/A') || ') scored ' || ROUND(NEW.score, 4) || ' in ' || UPPER(NEW.bucket) || ' risk bucket.',
      NEW.bucket,
      'open'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_risk_alert ON risk_scores;
CREATE TRIGGER trg_generate_risk_alert
AFTER INSERT ON risk_scores
FOR EACH ROW
EXECUTE FUNCTION generate_risk_alert();
