import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fdqnhntgqvragifackuv.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkcW5obnRncXZyYWdpZmFja3V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MTkyNDQsImV4cCI6MjA4OTE5NTI0NH0.CTUWW6xngC-2Myn5_fL8ntl5HrjIyHzCcOMAtRLsGTM'
const supabase = createClient(supabaseUrl, supabaseKey)

async function getHabits() {
  const { data, error } = await supabase.from('habits').select('*')
  console.log('Habits count:', data ? data.length : 0)
  if (data && data.length > 0) {
    console.log('First habit user_id:', data[0].user_id)
    const distinctUsers = [...new Set(data.map(h => h.user_id))]
    console.log('Distinct user IDs in habits:', distinctUsers)
  }
}

getHabits()
