import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

function formatDateLocal(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getTodayKey() {
  return formatDateLocal(new Date())
}

function calculateStreak(completedDates) {
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = formatDateLocal(d)
    if (completedDates.has(key)) {
      streak++
    } else {
      break
    }
  }
  return streak
}

function getWeekDays() {
  const days = []
  const today = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    days.push(formatDateLocal(d))
  }
  return days
}

function getLevelInfo(totalXP) {
  let level = 1
  let xpUsed = 0
  while (xpUsed + level * 100 <= totalXP) {
    xpUsed += level * 100
    level++
  }
  const xpForNextLevel = level * 100
  const xpIntoLevel = totalXP - xpUsed
  return { level, xpIntoLevel, xpForNextLevel, progress: xpIntoLevel / xpForNextLevel }
}

function computeDuration(timeStart, timeEnd) {
  if (!timeStart || !timeEnd) return null
  const [sh, sm] = timeStart.split(':').map(Number)
  const [eh, em] = timeEnd.split(':').map(Number)
  const diff = (eh * 60 + em) - (sh * 60 + sm)
  return diff > 0 ? diff : null
}

export function useHabits(userId) {
  const [habits, setHabits] = useState([])
  const [completions, setCompletions] = useState([]) // flat array of all completion rows
  const [summaries, setSummaries] = useState([]) // daily snapshots
  const [loading, setLoading] = useState(true)

  // ── Fetch all data ──────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const [habitsRes, completionsRes, summariesRes] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', userId),
      supabase.from('habit_completions').select('*').eq('user_id', userId),
      supabase.from('daily_summaries').select('*').eq('user_id', userId),
    ])
    const today = getTodayKey()
    if (habitsRes.data) setHabits(habitsRes.data)
    if (completionsRes.data) {
      // Filtra registros acidentais do futuro (causados pelo bug anterior de fuso)
      const sanitized = completionsRes.data.filter(c => c.completed_date <= today)
      setCompletions(sanitized)
    }
    if (summariesRes.data) {
      const sanitizedSum = summariesRes.data.filter(s => s.summary_date <= today)
      setSummaries(sanitizedSum)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ── CRUD ────────────────────────────────────────────────────
  const addHabit = async ({ name, emoji, color, timeStart, timeEnd, xp }) => {
    console.log('Tentando adicionar hábito:', { name, emoji, color, userId })
    const { data, error } = await supabase.from('habits').insert({
      user_id: userId,
      name,
      emoji,
      color,
      time_start: timeStart || null,
      time_end: timeEnd || null,
      xp: xp || 10,
    }).select().single()

    if (error) {
      console.error('Erro ao adicionar no Supabase:', error.message, error.details)
      alert('Erro ao salvar hábito: ' + error.message)
      return
    }

    if (data) {
      console.log('Sucesso! Hábito criado:', data)
      setHabits((prev) => [...prev, data])
    }
  }

  const deleteHabit = async (id) => {
    await supabase.from('habits').delete().eq('id', id)
    setHabits((prev) => prev.filter((h) => h.id !== id))
    setCompletions((prev) => prev.filter((c) => c.habit_id !== id))
  }

  const editHabit = async (id, { name, emoji, color, timeStart, timeEnd, xp }) => {
    const { data, error } = await supabase.from('habits').update({
      name,
      emoji,
      color,
      time_start: timeStart || null,
      time_end: timeEnd || null,
      xp: xp || 10,
    }).eq('id', id).select().single()
    if (!error && data) {
      setHabits((prev) => prev.map((h) => h.id === id ? data : h))
    }
  }

  const toggleToday = async (id) => {
    const today = getTodayKey()
    const habit = habits.find((h) => h.id === id)
    if (!habit) return

    const existing = completions.find(
      (c) => c.habit_id === id && c.completed_date === today
    )

    if (existing) {
      // Undo: delete completion
      await supabase.from('habit_completions').delete().eq('id', existing.id)
      setCompletions((prev) => prev.filter((c) => c.id !== existing.id))
    } else {
      // Complete: insert completion
      const { data, error } = await supabase.from('habit_completions').insert({
        habit_id: id,
        user_id: userId,
        completed_date: today,
        xp_earned: habit.xp,
      }).select().single()
      if (!error && data) setCompletions((prev) => [...prev, data])
    }
  }

  const finalizeDay = async (dateStr) => {
    const habitsOnDay = habits.filter(h => {
      if (!h.created_at) return true
      return formatDateLocal(h.created_at) <= dateStr
    })
    
    const xpTotal = habitsOnDay.reduce((sum, h) => sum + (h.xp || 10), 0)
    const items = completions.filter(c => c.completed_date === dateStr)
    const xpDone = items.reduce((sum, c) => sum + (c.xp_earned || 0), 0)
    const doneCount = habitsOnDay.filter(h => items.some(c => c.habit_id === h.id)).length

    const { data, error } = await supabase.from('daily_summaries').upsert({
      user_id: userId,
      summary_date: dateStr,
      completed_xp: xpDone,
      total_xp: xpTotal,
      habits_done: doneCount,
      habits_total: habitsOnDay.length
    }, { onConflict: 'user_id,summary_date' }).select().single()

    if (!error && data) {
      setSummaries(prev => {
        const filtered = prev.filter(s => s.summary_date !== dateStr)
        return [...filtered, data]
      })
    }
  }

  // Auto-finalização para dias passados
  useEffect(() => {
    if (loading || !userId || habits.length === 0) return
    
    const checkAutoFinalize = async () => {
      const today = new Date().toISOString().slice(0, 10)
      for (let i = 1; i <= 3; i++) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = formatDateLocal(d)
        
        const alreadyFinalized = summaries.some(s => s.summary_date === dateStr)
        if (!alreadyFinalized) {
          await finalizeDay(dateStr)
        }
      }
    }
    
    checkAutoFinalize()
  }, [loading, userId, habits.length, summaries])

  // ── Derived state ────────────────────────────────────────────
  
  // Build a map: habitId → Set of completed dates (for streak & weekDays)
  const completionMap = {}
  for (const c of completions) {
    if (!completionMap[c.habit_id]) completionMap[c.habit_id] = new Set()
    completionMap[c.habit_id].add(c.completed_date)
  }

  // Barra 1: Progresso do Dia (XP Concluído / XP Total do Dia)
  const totalDailyXP = habits.reduce((sum, h) => sum + (h.xp || 10), 0)
  const todayXP = completions
    .filter((c) => c.completed_date === getTodayKey())
    .reduce((sum, c) => sum + (c.xp_earned || 0), 0)
  
  const dailyProgressXP = totalDailyXP > 0 ? (todayXP / totalDailyXP) * 100 : 0
  const habitsDoneCount = habits.filter(h => completionMap[h.id]?.has(getTodayKey())).length

  // Barra 2: Nível de Constância (Foco em Performance Recente - últimos 14 dias)
  const calculateConsistencyLevel = () => {
    const today = new Date()
    const last14Days = []
    for (let i = 0; i < 14; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      last14Days.push(formatDateLocal(d))
    }

    let totalWeight = 0
    let weightedConsistency = 0

    last14Days.forEach((date, index) => {
      // Peso maior para dias mais recentes (dia atual tem peso 14, 14 dias atrás tem peso 1)
      const weight = 14 - index
      totalWeight += weight

      const habitsOnDay = habits.filter(h => {
        if (!h.created_at) return true
        return formatDateLocal(h.created_at) <= date
      })
      const xpExpected = habitsOnDay.reduce((sum, h) => sum + (h.xp || 10), 0)
      const xpEarned = completions
        .filter(c => c.completed_date === date)
        .reduce((sum, c) => sum + (c.xp_earned || 0), 0)

      const dayConsistency = xpExpected > 0 ? (xpEarned / xpExpected) : 0
      weightedConsistency += dayConsistency * weight
    })

    return (weightedConsistency / totalWeight) * 100
  }

  const consistencyScore = calculateConsistencyLevel()
  
  // Mapeamos o score (0-100) para um Nível Textual
  const getConsistencyTier = (score) => {
    if (score >= 95) return { tier: 'Lendário', color: '#3b82f6' }
    if (score >= 80) return { tier: 'Elite', color: '#60a5fa' }
    if (score >= 60) return { tier: 'Focado', color: '#93c5fd' }
    if (score >= 40) return { tier: 'Estável', color: '#cbd5e1' }
    if (score >= 20) return { tier: 'Iniciante', color: '#94a3b8' }
    return { tier: 'Inativo', color: '#64748b' }
  }

  const performanceLevel = getConsistencyTier(consistencyScore)
  const totalXP = completions.reduce((sum, c) => sum + (c.xp_earned || 0), 0)

  const weekDays = getWeekDays()

  const enrichedHabits = habits.map((h) => {
    const datesSet = completionMap[h.id] || new Set()
    return {
      ...h,
      // Normalize snake_case fields to camelCase for the UI
      timeStart: h.time_start,
      timeEnd: h.time_end,
      doneToday: datesSet.has(getTodayKey()),
      streak: calculateStreak(datesSet),
      weekDays: weekDays.map((day) => ({ key: day, done: datesSet.has(day) })),
      timeDuration: computeDuration(h.time_start, h.time_end),
    }
  })

  // Sort: timed habits first by start time, untimed at end
  enrichedHabits.sort((a, b) => {
    if (a.time_start && b.time_start) return a.time_start.localeCompare(b.time_start)
    if (a.time_start) return -1
    if (b.time_start) return 1
    return 0
  })

  return {
    habits: enrichedHabits,
    loading,
    addHabit,
    editHabit,
    deleteHabit,
    toggleToday,
    todayXP,
    totalDailyXP,
    totalXP,
    dailyProgressXP,
    habitsDoneCount,
    performanceLevel,
    consistencyScore,
    completions,
    summaries,
    finalizeDay,
    getTodayKey,
    isTodayFinalized: summaries.some(s => s.summary_date === getTodayKey())
  }
}
