import { useState, useEffect } from 'react'
import { useHabits } from './hooks/useHabits'
import { useAuth } from './hooks/useAuth'
import HabitCard from './components/HabitCard'
import HabitForm from './components/HabitForm'
import AuthPage from './components/Auth/AuthPage'
import HistoryView from './components/History/HistoryView'
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
  const { user, loading: authLoading, signIn, signUp, signOut } = useAuth()
  const { 
    habits, loading: habitsLoading, addHabit, editHabit, deleteHabit, toggleToday, 
    todayXP, totalDailyXP, dailyProgressXP, habitsDoneCount, performanceLevel, consistencyScore, 
    completions, summaries, finalizeDay, getTodayKey, isTodayFinalized 
  } = useHabits(user?.id)

  const [view, setView] = useState('today') // 'today' | 'history'
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
    <div className={`app ${dailyProgressXP >= 90 ? 'success-bg' : ''}`}>
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
          ) : habits.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🌱</div>
              <h2>Comece sua jornada</h2>
              <p>Adicione seu primeiro hábito e acompanhe seu progresso diário.</p>
              <button className="empty-btn" onClick={() => { setEditingHabit(null); setShowForm(true) }}>
                + Adicionar hábito
              </button>
            </div>
          ) : (
            <div className="habit-list">
              {habits.map((habit) => (
                <HabitCard
                  key={habit.id}
                  habit={habit}
                  onToggle={isTodayFinalized ? () => {} : toggleToday}
                  onDelete={isTodayFinalized ? null : deleteHabit}
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
          <HistoryView habits={habits} completions={completions} summaries={summaries} />
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
    </div>
  )
}
