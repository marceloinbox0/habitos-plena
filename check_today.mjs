
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fdqnhntgqvragifackuv.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkcW5obnRncXZyYWdpZmFja3V2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzYxOTI0NCwiZXhwIjoyMDg5MTk1MjQ0fQ.3boirmPTwXlHq9ygYlTjM_eqG9XHRwh-hnAGPFv6Z3g'
const supabase = createClient(supabaseUrl, serviceRoleKey)

const userId = '17695f84-688c-4936-94ec-5a4a571a3b31'
const today = '2026-03-19'

async function checkToday() {
  console.log(`Checking completions for ${userId} on ${today}`)
  
  const { data: comp } = await supabase
    .from('habit_completions')
    .select('*, habits(name)')
    .eq('user_id', userId)
    .eq('completed_date', today)

  if (comp) {
    console.log(`Found ${comp.length} completions for today.`)
    comp.forEach(c => {
      console.log(`- Habit: ${c.habits?.name || c.habit_id} | XP: ${c.xp_earned}`)
    })
  } else {
    console.log('No completions found for today.')
  }
}

checkToday()
