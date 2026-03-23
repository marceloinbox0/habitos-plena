import { useState, useEffect } from 'react'
import { useHabits } from './hooks/useHabits'
import { useAuth } from './hooks/useAuth'
import { supabase } from './lib/supabase'
import HabitCard from './components/HabitCard'
import HabitForm from './components/HabitForm'
import AuthPage from './components/Auth/AuthPage'
import HistoryView from './components/History/HistoryView'
import SettingsModal from './components/Settings/SettingsModal'
import './App.css'

function getTodayLabel() {
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  const months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  const d = new Date()
  return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]}`
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a14' }}>
      <div style={{ fontSize: '2rem', animation: 'spin 1s linear infinite' }}>✨</div>
    </div>
  )
}

export default function App() {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('vidaplena_settings')
      return saved ? JSON.parse(saved) : { theme: 'system', daysOff: { saturday: false, sunday: false }, dayOffHabits: { saturday: [], sunday: [] } }
    } catch {
      return { theme: 'system', daysOff: { saturday: false, sunday: false }, dayOffHabits: { saturday: [], sunday: [] } }
    }
  })

  useEffect(() => {
    localStorage.setItem('vidaplena_settings', JSON.stringify(settings))
    const root = document.documentElement
    
    if (settings.theme === 'light') {
      root.setAttribute('data-theme', 'light')
    } else if (settings.theme === 'dark') {
      root.removeAttribute('data-theme')
    } else {
      // system
      const isSysDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (isSysDark) {
        root.removeAttribute('data-theme')
      } else {
        root.setAttribute('data-theme', 'light')
      }
    }
  }, [settings])

  const { user, loading: authLoading, signIn, signUp, signOut } = useAuth()

  useEffect(() => {
    if (user?.user_metadata?.settings) {
      setSettings(prev => ({ ...prev, ...user.user_metadata.settings }))
    }
  }, [user])

  const { 
    habits, loading: habitsLoading, addHabit, editHabit, deleteHabit, archiveHabit, unarchiveHabit, toggleToday, 
    todayXP, totalDailyXP, dailyProgressXP, habitsDoneCount, performanceLevel, consistencyScore, 
    completions, summaries, finalizeDay, getTodayKey, isTodayFinalized 
  } = useHabits(user?.id, settings.daysOff, settings.dayOffHabits)

  const handleSaveSettings = async (newSettings) => {
    setSettings(newSettings)
    if (user) {
      const { error } = await supabase.auth.updateUser({
        data: { settings: newSettings }
      })
      if (error) {
        console.error('Erro ao sincronizar configurações na nuvem:', error)
      }
    }
  }

  const isTodayDayOff = (() => {
    const d = new Date()
    const dayOfWeek = d.getDay()
    return (dayOfWeek === 6 && settings.daysOff?.saturday) || (dayOfWeek === 0 && settings.daysOff?.sunday)
  })()

  const habitsToRender = habits.filter(h => {
    if (h.archived) return false
    if (isTodayDayOff) {
      const dayOfWeek = new Date().getDay()
      if (dayOfWeek === 6 && settings.dayOffHabits?.saturday) {
        return settings.dayOffHabits.saturday.includes(h.id)
      }
      if (dayOfWeek === 0 && settings.dayOffHabits?.sunday) {
        return settings.dayOffHabits.sunday.includes(h.id)
      }
      if (Array.isArray(settings.dayOffHabits)) {
        return settings.dayOffHabits.includes(h.id)
      }
    }
    return true
  })

  const [view, setView] = useState('today') // 'today' | 'history'
  const [showSettings, setShowSettings] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingHabit, setEditingHabit] = useState(null)
  const [showMilestone, setShowMilestone] = useState(false)
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false)

  // Controle do Milestone de 75%
  useEffect(() => {
    if (habits.length === 0) return
    
    const today = new Date().toISOString().slice(0, 10)
    const milestoneKey = `milestone_75_${user?.id}_${today}`
    const alreadyShown = localStorage.getItem(milestoneKey)

    if (dailyProgressXP >= 75 && !alreadyShown) {
      setShowMilestone(true)
      localStorage.setItem(milestoneKey, 'true')
    }
  }, [dailyProgressXP, user?.id, habits.length])

  if (authLoading) return <LoadingScreen />
  if (!user) return <AuthPage signIn={signIn} signUp={signUp} />

  const openEdit = (habit) => {
    setEditingHabit(habit)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingHabit(null)
  }

  const handleFormSubmit = ({ name, emoji, color, timeStart, timeEnd, xp }) => {
    if (editingHabit) {
      editHabit(editingHabit.id, { name, emoji, color, timeStart, timeEnd, xp })
    } else {
      addHabit({ name, emoji, color, timeStart, timeEnd, xp })
    }
  }

  if (authLoading) return <LoadingScreen />
  if (!user) return <AuthPage signIn={signIn} signUp={signUp} />

  return (
    <div className={`app ${dailyProgressXP >= 90 && view === 'today' ? 'success-bg' : ''}`}>
      <header className="header">
        <div className="header-top">
          <div>
            <h1 className="app-title">VidaPlena</h1>
            <p className="app-date">{getTodayLabel()}</p>
          </div>
          <div className="header-actions">
            <button 
              className={`view-toggle ${view === 'history' ? 'active' : ''}`}
              onClick={() => setView(view === 'today' ? 'history' : 'today')}
              title={view === 'today' ? 'Ver Histórico' : 'Ver Hoje'}
            >
              {view === 'today' ? '📊' : '📅'}
            </button>
            <button 
              className="view-toggle"
              onClick={() => setShowSettings(true)}
              title="Configurações"
            >
              ⚙️
            </button>
            <button
              className="add-btn"
              onClick={() => { setEditingHabit(null); setShowForm(true) }}
              aria-label="Adicionar novo hábito"
            >
              +
            </button>
            <button className="signout-btn" onClick={signOut} title="Sair">↩</button>
          </div>
        </div>

        {habits.length > 0 && (
          <div className="progress-wrap">
            <div className="progress-info">
              <span>Foco do Dia <strong style={{ color: 'var(--accent)', marginLeft: '4px' }}>{Math.round(dailyProgressXP)}%</strong></span>
              <span>{todayXP}/{totalDailyXP} XP · {habitsDoneCount}/{habits.length} hábitos</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${dailyProgressXP}%` }}></div>
            </div>
          </div>
        )}

        <div className="xp-bar-wrap">
          <div className="xp-info">
            <span className="xp-level" style={{ color: performanceLevel.color }}>
              Nível: {performanceLevel.tier}
            </span>
            <span className="xp-count">
              Constância: <span className="xp-today" style={{ color: performanceLevel.color }}>{Math.round(consistencyScore)}%</span>
            </span>
          </div>
          <div className="xp-bar">
            <div 
              className="xp-fill" 
              style={{ 
                width: `${consistencyScore}%`,
                background: performanceLevel.color 
              }}
            ></div>
          </div>
        </div>
      </header>

      <main className="main">
        {view === 'today' ? (
          habitsLoading ? (
            <div className="empty">
              <div className="empty-icon" style={{ animation: 'float 1s ease-in-out infinite' }}>⏳</div>
              <p>Carregando seus hábitos...</p>
            </div>
          ) : habitsToRender.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🌱</div>
              {isTodayDayOff ? (
                <>
                  <h2>Hoje é seu dia de folga, descanse.</h2>
                  <p>Você não selecionou nenhum hábito obrigatório para aparecer hoje.</p>
                </>
              ) : (
                <>
                  <h2>Comece sua jornada</h2>
                  <p>Adicione seu primeiro hábito e acompanhe seu progresso diário.</p>
                  <button className="empty-btn" onClick={() => { setEditingHabit(null); setShowForm(true) }}>
                    + Adicionar hábito
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="habit-list">
              {isTodayDayOff && (
                 <div style={{ textAlign: 'center', padding: '0.85rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                   🏖️ <strong style={{ color: 'var(--accent)' }}>Hoje é seu dia de folga, descanse.</strong>
                 </div>
              )}
              {habitsToRender.map((habit) => (
                <HabitCard
                  key={habit.id}
                  habit={habit}
                  onToggle={isTodayFinalized ? () => {} : toggleToday}
                  onDelete={isTodayFinalized ? null : deleteHabit}
                  onArchive={isTodayFinalized ? null : archiveHabit}
                  onEdit={isTodayFinalized ? null : openEdit}
                  disabled={isTodayFinalized}
                />
              ))}
              
              <div className="finalize-section">
                <button 
                  className={`finalize-btn ${isTodayFinalized ? 'finalized' : ''}`}
                  onClick={() => !isTodayFinalized && setShowFinalizeConfirm(true)}
                  disabled={isTodayFinalized}
                >
                  {isTodayFinalized ? (
                    <>
                      <span>{Math.round(dailyProgressXP)}% de XP Concluído</span>
                      <span className="finalized-indicator">✓ Finalizado</span>
                    </>
                  ) : (
                    <>Finalizar Dia 🏁</>
                  )}
                </button>
                {!isTodayFinalized ? (
                  <p className="finalize-hint">Salve seu progresso de hoje para o histórico</p>
                ) : (
                  <p className="finalize-hint" style={{ color: 'rgba(34, 197, 94, 0.6)' }}>Este dia está blindado contra alterações</p>
                )}
              </div>
            </div>
          )
        ) : (
          <HistoryView 
            habits={habits} 
            completions={completions} 
            summaries={summaries} 
            daysOff={settings.daysOff}
            dayOffHabits={settings.dayOffHabits}
          />
        )}
      </main>

      {showForm && (
        <HabitForm
          onAdd={handleFormSubmit}
          onClose={closeForm}
          habit={editingHabit}
        />
      )}
      {showMilestone && (
        <div className="milestone-overlay" onClick={() => setShowMilestone(false)}>
          <div className="milestone-card" onClick={e => e.stopPropagation()}>
            <div className="milestone-rocket">🚀</div>
            <h2 className="milestone-title">75% Concluído!</h2>
            <p className="milestone-text">Muito bem! Você está no caminho certo! Perseverança sempre!</p>
            <button className="milestone-btn" onClick={() => setShowMilestone(false)}>
              Continuar
            </button>
          </div>
        </div>
      )}
      {showFinalizeConfirm && (
        <div className="milestone-overlay" onClick={() => setShowFinalizeConfirm(false)}>
          <div className="milestone-card" onClick={e => e.stopPropagation()}>
            <div className="milestone-rocket">🏆</div>
            <h2 className="milestone-title">Parabéns pelo esforço!</h2>
            <p className="milestone-text">
              Você alcançou {Math.round(dailyProgressXP)}% do seu foco hoje! Deseja registrar e finalizar este dia? (Não será possível alterar os hábitos de hoje depois disso)
            </p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', width: '100%' }}>
              <button 
                className="milestone-btn" 
                style={{ background: '#333', color: '#fff', flex: 1 }}
                onClick={() => setShowFinalizeConfirm(false)}
              >
                Voltar
              </button>
              <button 
                className="milestone-btn" 
                style={{ flex: 1 }}
                onClick={() => {
                  finalizeDay(getTodayKey())
                  setShowFinalizeConfirm(false)
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSave={handleSaveSettings}
          habits={habits}
          onUnarchive={unarchiveHabit}
          onDelete={deleteHabit}
        />
      )}
    </div>
  )
}
