-- Create borrowers table
CREATE TABLE borrowers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  geography TEXT,
  employment_type TEXT,
  loan_purpose TEXT,
  loan_amount NUMERIC NOT NULL,
  monthly_income NUMERIC,
  outstanding_balance NUMERIC,
  tenure_months INTEGER
);

-- Create risk_scores table
CREATE TABLE risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES borrowers(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL,
  bucket TEXT NOT NULL CHECK (bucket IN ('low', 'medium', 'high', 'critical')),
  model_version TEXT NOT NULL,
  scored_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create risk_reasons table
CREATE TABLE risk_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  score_id UUID NOT NULL REFERENCES risk_scores(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL,
  impact_magnitude NUMERIC NOT NULL,
  impact_direction TEXT NOT NULL CHECK (impact_direction IN ('+', '-')),
  description TEXT
);

-- Create alerts table
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES borrowers(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all tables
CREATE POLICY "Enable read access for all authenticated users on borrowers"
ON borrowers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable read access for all authenticated users on risk_scores"
ON risk_scores FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable read access for all authenticated users on risk_reasons"
ON risk_reasons FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable read access for all authenticated users on alerts"
ON alerts FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to update alerts
CREATE POLICY "Enable update access for authenticated users on alerts"
ON alerts FOR UPDATE TO authenticated USING (true);

-- Function and trigger to auto-create alerts
CREATE OR REPLACE FUNCTION generate_risk_alert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bucket IN ('high', 'critical') THEN
    INSERT INTO alerts (borrower_id, severity, status)
    VALUES (NEW.borrower_id, NEW.bucket, 'open');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_risk_alert
AFTER INSERT ON risk_scores
FOR EACH ROW
EXECUTE FUNCTION generate_risk_alert();
