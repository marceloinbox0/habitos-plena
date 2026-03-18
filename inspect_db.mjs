
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fdqnhntgqvragifackuv.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkcW5obnRncXZyYWdpZmFja3V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MTkyNDQsImV4cCI6MjA4OTE5NTI0NH0.CTUWW6xngC-2Myn5_fL8ntl5HrjIyHzCcOMAtRLsGTM'
const supabase = createClient(supabaseUrl, supabaseKey)

async function inspect() {
  console.log('--- INSPEÇÃO DE DADOS ---')
  const { data: comp } = await supabase.from('habit_completions').select('*')
  console.log('Completions dates:', comp?.map(c => c.completed_date))
  
  try {
    const { data: sum } = await supabase.from('daily_summaries').select('*')
    console.log('Summaries dates:', sum?.map(s => s.summary_date))
  } catch (e) {
    console.log('Tabela daily_summaries não acessível.')
  }
}

inspect()
