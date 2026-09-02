-- Migration 0002: Ensure alerts status update policy exists for authenticated users
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'alerts' AND policyname = 'authenticated_update_alerts'
  ) THEN
    CREATE POLICY "authenticated_update_alerts" 
    ON alerts FOR UPDATE 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);
  END IF;
END $$;
