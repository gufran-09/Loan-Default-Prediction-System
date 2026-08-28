import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient();
  const {data:{user}} = await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:{code:'UNAUTHORIZED',message:'Authentication required'}},{status:401});
  
  const {data,error} = await supabase.from('alerts').select('*,borrowers(name,email)').order('created_at',{ascending:false});
  
  if(error) return NextResponse.json({error:{code:'DB_ERROR',message:'Unable to load alerts'}},{status:500});
  return NextResponse.json({data:data||[]})
}
