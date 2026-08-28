import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient();
  const {data:{user}} = await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:{code:'UNAUTHORIZED',message:'Authentication required'}},{status:401});
  
  const {data,error} = await supabase.from('borrowers').select('loan_purpose,geography,tenure_months,risk_scores(bucket,score)');
  
  if(error) return NextResponse.json({error:{code:'DB_ERROR',message:'Unable to load analytics'}},{status:500});
  
  const rows = data||[];
  const group = (key:string) => Object.values(rows.reduce((a:any,r:any)=>{
    const k = r[key] || 'Unknown';
    a[k] ??= {name:k,total:0,score:0};
    a[k].total++;
    // Some borrowers might have multiple risk scores if array, but here it's expected to be 1-to-1 or 1-to-many. 
    // Assuming risk_scores is an array (inner join might return array of scores, but in our schema it's 1-to-many, we'll take the first or assume array)
    const scoreVal = Array.isArray(r.risk_scores) ? Number(r.risk_scores[0]?.score||0) : Number(r.risk_scores?.score||0);
    a[k].score += scoreVal;
    return a;
  },{})).map((x:any)=>({...x,score:Number((x.score/x.total).toFixed(2))}));
  
  return NextResponse.json({data:{byLoanType:group('loan_purpose'),byGeography:group('geography'),byTenure:group('tenure_months')}})
}
