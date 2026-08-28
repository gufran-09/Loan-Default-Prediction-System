import { createClient } from '../supabase/server'

export interface RiskReason {
  feature_name: string
  impact_magnitude: number
  impact_direction: '+' | '-'
  description: string
}

export interface ScoreResult {
  score: number
  bucket: 'low' | 'medium' | 'high' | 'critical'
  model_version: string
  scored_at: string
  risk_reasons: RiskReason[]
}

export async function getScore(borrowerId: string): Promise<ScoreResult | null> {
  const supabase = await createClient()

  const { data: scoreData, error: scoreError } = await supabase
    .from('risk_scores')
    .select('*')
    .eq('borrower_id', borrowerId)
    .single()

  if (scoreError || !scoreData) {
    console.error('Error fetching score:', scoreError)
    return null
  }

  const { data: reasonsData, error: reasonsError } = await supabase
    .from('risk_reasons')
    .select('feature_name, impact_magnitude, impact_direction, description')
    .eq('score_id', scoreData.id)

  if (reasonsError) {
    console.error('Error fetching reasons:', reasonsError)
    return null
  }

  return {
    score: scoreData.score,
    bucket: scoreData.bucket,
    model_version: scoreData.model_version,
    scored_at: scoreData.scored_at,
    risk_reasons: reasonsData || [],
  }
}
