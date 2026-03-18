import { useState } from 'react'
import styles from './HabitForm.module.css'

const EMOJIS = [
  // Saúde e Esporte
  '💪', '🏃', '🧘', '💧', '🥗', '🍎', '🚴', '🏊', '🎾', '⚽', '🥊', '🏀', '🏋️', '🚶', '🤸', '🧗',
  // Foco e Estudo
  '📚', '✍️', '🎯', '💡', '🧠', '🎓', '📖', '📝', '📍', '🧪', '🔭', '🎨', '🎻', '🎹', '🎼',
  // Trabalho e Tecnologia
  '💻', '📅', '✉️', '📞', '🛠️', '⚙️', '📊', '📈', '📁', '💼', '💻', '🖥️', '⌨️', '🖱️', '🔋',
  // Lazer e Hobbies
  '🎵', '🎸', '📸', '🎮', '🌱', '🪁', '🧶', '🧵', '🎭', '🎬', '🍿', '📺', '🎲', '🧩', '🃏',
  // Casa e Rotina
  '🧹', '🧼', '🍳', '🛒', '🏡', '👕', '🧺', '🚿', '🛏️', '🛋️', '🔑', '🕯️', '🧴', '🪒', '🧸',
  // Natureza e Pets
  '🐕', '🐈', '🦜', '🐹', '🐟', '🦁', '🌿', '🍂', '🍄', '🌍', '☀️', '🌙', '🌊', '🔥', '❄️',
  // Humor e Social
  '😊', '😎', '🙌', '🤝', '🗣️', '☕', '🍵', '🍦', '🍩', '🍕', '🍻', '🥂', '🎉', '🎁', '✨'
]

const PARTIAL_COUNT = 12 // Mostra 12 por padrão
const COLORS = [
  '#3b82f6', '#60a5fa', '#34d399', '#f87171',
  '#fbbf24', '#818cf8', '#2dd4bf', '#94a3b8',
]
const XP_PRESETS = [5, 10, 25, 50, 100]

export default function HabitForm({ onAdd, onClose, habit }) {
  const isEditing = !!habit
  const [name, setName] = useState(habit?.name ?? '')
  const [emoji, setEmoji] = useState(habit?.emoji ?? '💪')
  const [color, setColor] = useState(habit?.color ?? '#3b82f6')
  const [timeStart, setTimeStart] = useState(habit?.timeStart ?? '')
  const [timeEnd, setTimeEnd] = useState(habit?.timeEnd ?? '')
  const [xp, setXp] = useState(habit?.xp ?? 10)
  const [isEmojiExpanded, setIsEmojiExpanded] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onAdd({ name: name.trim(), emoji, color, timeStart: timeStart || null, timeEnd: timeEnd || null, xp: Number(xp) })
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>{isEditing ? 'Editar Hábito' : 'Novo Hábito'}</h2>
        <form onSubmit={handleSubmit}>

          <div className={styles.field}>
            <label>Nome do hábito</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Beber água, Ler 20min..."
              autoFocus
              maxLength={40}
            />
          </div>

          <div className={styles.twoCol}>
            <div className={styles.field}>
              <label>Início</label>
              <input
                type="time"
                value={timeStart}
                onChange={(e) => setTimeStart(e.target.value)}
                className={styles.timeInput}
              />
            </div>
            <div className={styles.field}>
              <label>Fim</label>
              <input
                type="time"
                value={timeEnd}
                onChange={(e) => setTimeEnd(e.target.value)}
                className={styles.timeInput}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label>XP ao completar</label>
            <div className={styles.xpPresets}>
              {XP_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`${styles.xpPresetBtn} ${xp === p ? styles.xpSelected : ''}`}
                  onClick={() => setXp(p)}
                >
                  ⭐ {p}
                </button>
              ))}
              <input
                type="number"
                value={xp}
                onChange={(e) => setXp(Math.max(1, Math.min(999, Number(e.target.value))))}
                min={1}
                max={999}
                className={styles.xpInputInline}
                title="XP personalizado"
              />
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label>Emoji</label>
              <button
                type="button"
                className={styles.expandBtn}
                onClick={() => setIsEmojiExpanded(!isEmojiExpanded)}
              >
                {isEmojiExpanded ? 'Ver menos' : 'Mais emojis'}
              </button>
            </div>
            <div className={`${styles.emojiGrid} ${isEmojiExpanded ? styles.expanded : ''}`}>
              {(isEmojiExpanded ? EMOJIS : EMOJIS.slice(0, PARTIAL_COUNT)).map((e) => (
                <button
                  key={e}
                  type="button"
                  className={`${styles.emojiBtn} ${emoji === e ? styles.selected : ''}`}
                  onClick={() => setEmoji(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label>Cor</label>
            <div className={styles.colorGrid}>
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.colorBtn} ${color === c ? styles.selected : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.cancel} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className={styles.submit} style={{ background: color }} disabled={!name.trim()}>
              {isEditing ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
