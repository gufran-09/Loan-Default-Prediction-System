import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) { 
  const supabase = await createClient(); 
  const {data:{user}} = await supabase.auth.getUser(); 
  if(!user) return NextResponse.json({error:{code:'UNAUTHORIZED',message:'Authentication required'}},{status:401}); 
  
  const url = new URL(request.url); 
  const page = Math.max(1,Number(url.searchParams.get('page')||1)); 
  const pageSize = Math.min(50,Math.max(1,Number(url.searchParams.get('pageSize')||10))); 
  const search = url.searchParams.get('search')||''; 
  const bucket = url.searchParams.get('bucket')||''; 
  
  let query = supabase.from('borrowers').select('*,risk_scores!inner(score,bucket,model_version,scored_at)',{count:'exact'}).order('name'); 
  
  if(search) query = query.ilike('name', `%${search}%`); 
  if(bucket) query = query.eq('risk_scores.bucket',bucket); 
  
  const from = (page-1)*pageSize; 
  const {data,error,count} = await query.range(from,from+pageSize-1); 
  
  if(error) return NextResponse.json({error:{code:'DB_ERROR',message:'Unable to load borrowers'}},{status:500}); 
  
  return NextResponse.json({data:data||[],pagination:{page,pageSize,total:count||0,totalPages:Math.ceil((count||0)/pageSize)}}) 
}
