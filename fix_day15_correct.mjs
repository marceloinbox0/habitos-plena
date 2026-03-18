import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fdqnhntgqvragifackuv.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkcW5obnRncXZyYWdpZmFja3V2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzYxOTI0NCwiZXhwIjoyMDg5MTk1MjQ0fQ.3boirmPTwXlHq9ygYlTjM_eqG9XHRwh-hnAGPFv6Z3g'
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const dateStr = '2026-03-15'
  const userId = '17695f84-688c-4936-94ec-5a4a571a3b31'

  const { data: habits } = await supabase.from('habits').select('*').eq('user_id', userId)
  const habitsTotalCount = habits.length

  const { data: updateData, error } = await supabase
    .from('daily_summaries')
    .update({ 
      completed_xp: 75,
      total_xp: 425,
      habits_done: 3,
      habits_total: habitsTotalCount
    })
    .eq('user_id', userId)
    .eq('summary_date', dateStr)
    .select()

  if (error) {
    console.error('Erro:', error)
  } else {
    console.log('Atualizado dia 15:', updateData)
  }
}

run()
