-- Seed file for Aegis Risk Project
-- Create a test user: demo@aegisrisk.test / password123
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, aud, role, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'demo@aegisrisk.test',
  crypt('password123', gen_salt('bf')),
  NOW(),
  'authenticated',
  'authenticated',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  format('{"sub":"%s","email":"%s"}', '00000000-0000-0000-0000-000000000000', 'demo@aegisrisk.test')::jsonb,
  'email',
  NOW(),
  NOW(),
  NOW()
) ON CONFLICT (provider, id) DO NOTHING;

-- Mock Borrowers
INSERT INTO borrowers (id, name, email, geography, employment_type, loan_purpose, loan_amount, monthly_income, outstanding_balance, tenure_months)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'John Doe', 'john.doe@example.com', 'North America', 'Salaried', 'Home Improvement', 50000, 8000, 15000, 36),
  ('22222222-2222-2222-2222-222222222222', 'Jane Smith', 'jane.smith@example.com', 'Europe', 'Self-Employed', 'Business', 120000, 15000, 45000, 60),
  ('33333333-3333-3333-3333-333333333333', 'Alice Johnson', 'alice.j@example.com', 'Asia', 'Salaried', 'Education', 30000, 4000, 5000, 24)
ON CONFLICT DO NOTHING;

-- Mock Risk Scores
-- Notice Jane Smith is 'high' risk, Alice Johnson is 'critical' risk.
INSERT INTO risk_scores (id, borrower_id, score, bucket, model_version)
VALUES
  ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 0.15, 'low', 'v1.0'),
  ('a2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 0.72, 'high', 'v1.0'),
  ('a3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 0.88, 'critical', 'v1.0')
ON CONFLICT DO NOTHING;

-- Mock Risk Reasons
INSERT INTO risk_reasons (score_id, feature_name, impact_magnitude, impact_direction, description)
VALUES
  ('a1111111-1111-1111-1111-111111111111', 'monthly_income', 0.05, '-', 'High monthly income reduces risk'),
  ('a2222222-2222-2222-2222-222222222222', 'outstanding_balance', 0.12, '+', 'High existing balance increases risk'),
  ('a2222222-2222-2222-2222-222222222222', 'employment_type', 0.08, '+', 'Self-employed status adds volatility'),
  ('a3333333-3333-3333-3333-333333333333', 'loan_amount', 0.15, '+', 'Large loan amount relative to income'),
  ('a3333333-3333-3333-3333-333333333333', 'tenure_months', 0.10, '+', 'Short tenure increases monthly burden')
ON CONFLICT DO NOTHING;
