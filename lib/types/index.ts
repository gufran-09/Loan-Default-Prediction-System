export type RiskBucket = 'low' | 'medium' | 'high' | 'critical'
export type Borrower = { id:string; external_id:string; full_name:string; email:string; loan_type:string; loan_amount:number; outstanding_balance:number; geography:string; tenure_months:number; monthly_income:number; employment_status:string }
export type RiskScore = { score:number; bucket:RiskBucket; model_version:string; scored_at:string; reasons: { reason:string; feature:string; impact:number; rank:number }[] }
export type Alert = { id:string; borrower_id:string; title:string; description:string; severity:'high'|'medium'|'low'; status:'open'|'acknowledged'|'resolved'; created_at:string; borrower?:{full_name:string; external_id:string} }
