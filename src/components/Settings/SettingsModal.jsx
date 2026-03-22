import { useState, useEffect } from 'react'

export default function SettingsModal({ onClose, settings, onSave, habits = [], onUnarchive, onDelete }) {
  const [theme, setTheme] = useState(settings.theme || 'system')
  const [daysOff, setDaysOff] = useState(settings.daysOff || { saturday: false, sunday: false })
  const [dayOffHabits, setDayOffHabits] = useState(settings.dayOffHabits || [])
  const [showInactive, setShowInactive] = useState(false)
  const [showDayOffHabits, setShowDayOffHabits] = useState(false)

  const archivedHabits = habits.filter(h => h.archived)
  const activeHabits = habits.filter(h => !h.archived)

  const handleSave = () => {
    onSave({ theme, daysOff, dayOffHabits })
    onClose()
  }

  return (
    <div className="milestone-overlay" onClick={onClose}>
      <div className="milestone-card settings-card" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 className="milestone-title" style={{ margin: 0, fontSize: '1.4rem' }}>Configurações</h2>
          <button className="signout-btn" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '1.5rem' }}>×</button>
        </div>

        <div className="settings-section">
          <h3>Aparência do App</h3>
          <div className="settings-options">
            <label className={`settings-option ${theme === 'light' ? 'active' : ''}`}>
              <input type="radio" value="light" checked={theme === 'light'} onChange={() => setTheme('light')} />
              <span>☀️ Modo Claro</span>
            </label>
            <label className={`settings-option ${theme === 'dark' ? 'active' : ''}`}>
              <input type="radio" value="dark" checked={theme === 'dark'} onChange={() => setTheme('dark')} />
              <span>🌙 Modo Escuro</span>
            </label>
            <label className={`settings-option ${theme === 'system' ? 'active' : ''}`}>
              <input type="radio" value="system" checked={theme === 'system'} onChange={() => setTheme('system')} />
              <span>📱 Igual ao Aparelho</span>
            </label>
          </div>
        </div>

        <div className="settings-section">
          <h3>Dias de Folga</h3>
          <p className="settings-hint">Selecione os dias da semana que você quer tirar como descanso (opcional).</p>
          <div className="settings-checkboxes">
            <label className="settings-checkbox">
              <input 
                type="checkbox" 
                checked={daysOff.saturday} 
                onChange={(e) => setDaysOff({ ...daysOff, saturday: e.target.checked })} 
              />
              <span className="checkbox-custom"></span>
              <span>Sábado</span>
            </label>
            <label className="settings-checkbox">
              <input 
                type="checkbox" 
                checked={daysOff.sunday} 
                onChange={(e) => setDaysOff({ ...daysOff, sunday: e.target.checked })} 
              />
              <span className="checkbox-custom"></span>
              <span>Domingo</span>
            </label>
          </div>

          {(daysOff.saturday || daysOff.sunday) && (
             <div style={{ marginTop: '1.2rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
                <div 
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => setShowDayOffHabits(!showDayOffHabits)}
                >
                  <h4 style={{ fontSize: '0.95rem', margin: 0, color: 'var(--text)' }}>Configurar Rotina da Folga</h4>
                  <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>{showDayOffHabits ? '▼' : '▶'}</span>
                </div>

                {showDayOffHabits && (
                  <div style={{ marginTop: '1rem' }}>
                    <p className="settings-hint">Quais destes hábitos ativos vão aparecer no seu dia de folga?</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                       {activeHabits.map(h => (
                          <label key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                             <input 
                                type="checkbox" 
                                style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
                                checked={dayOffHabits.includes(h.id)} 
                                onChange={(e) => {
                                   if (e.target.checked) setDayOffHabits([...dayOffHabits, h.id])
                                   else setDayOffHabits(dayOffHabits.filter(id => id !== h.id))
                                }} 
                             />
                             <span style={{ fontSize: '0.88rem', color: 'var(--text)' }}>
                                <span style={{ fontSize: '1.1rem', marginRight: '4px' }}>{h.emoji}</span> 
                                {h.name}
                             </span>
                          </label>
                       ))}
                    </div>
                  </div>
                )}
             </div>
          )}
        </div>

        <div className="settings-section">
          <div 
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '0.5rem 0' }} 
            onClick={() => setShowInactive(!showInactive)}
          >
            <h3 style={{ margin: 0 }}>Hábitos Inativos</h3>
            <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>{showInactive ? '▼' : '▶'}</span>
          </div>
          
          {showInactive && (
            <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {archivedHabits.length === 0 ? (
                <p className="settings-hint" style={{ margin: 0 }}>Nenhum hábito inativo no momento.</p>
              ) : (
                archivedHabits.map(h => (
                  <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ fontSize: '1.3rem' }}>{h.emoji}</span>
                      <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.9rem' }}>{h.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button 
                        onClick={() => onUnarchive(h.id)} 
                        style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'inherit' }}
                      >
                        Reativar
                      </button>
                      <button 
                        onClick={() => {
                          if(window.confirm('Excluir DE VEZ da base de dados sem volta?')) {
                            onDelete(h.id)
                          }
                        }} 
                        style={{ background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', padding: '0.4rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}
                        title="Excluir Permanentemente"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <button className="milestone-btn" onClick={handleSave} style={{ marginTop: '1rem' }}>
          Salvar Configurações
        </button>
      </div>
    </div>
  )
}
