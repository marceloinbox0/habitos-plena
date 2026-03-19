import { useState } from 'react'
import styles from './HabitCard.module.css'

const DAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function getDayLabel(dateKey) {
  const d = new Date(dateKey + 'T12:00:00')
  return DAY_LABELS[d.getDay()]
}

function formatDuration(minutes) {
  if (!minutes) return null
  if (minutes < 60) return `${minutes}min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h${m}` : `${h}h`
}

function getCardSize(timeDuration) {
  if (!timeDuration) return 'small'
  if (timeDuration <= 60) return 'medium'
  return 'large'
}

function WeekGrid({ weekDays, color }) {
  return (
    <div className={styles.week}>
      {weekDays.map((day) => (
        <div key={day.key} className={styles.dayItem}>
          <div
            className={`${styles.dayDot} ${day.done ? styles.dayDone : ''}`}
            style={day.done ? { background: color } : undefined}
          />
          <span className={styles.dayLabel}>{getDayLabel(day.key)}</span>
        </div>
      ))}
    </div>
  )
}

function Badges({ habit }) {
  const hasTime = habit.timeStart || habit.timeEnd
  return (
    <div className={styles.badges}>
      {hasTime && (
        <span className={styles.badge}>
          🕐 {habit.timeStart || '?'}{habit.timeEnd ? ` – ${habit.timeEnd}` : ''}
        </span>
      )}
      <span className={`${styles.badge} ${styles.xpBadge}`}>⭐ {habit.xp} XP</span>
    </div>
  )
}

function CheckButton({ done, onToggle, large }) {
  return (
    <button
      className={`${styles.checkBtn} ${done ? styles.checked : ''} ${large ? styles.checkBtnLg : ''}`}
      onClick={() => onToggle()}
      aria-label={done ? 'Desfazer' : 'Marcar como feito'}
      title={done ? 'Clique para desfazer' : 'Marcar como feito'}
    >
      {done ? '✓' : ''}
    </button>
  )
}

export default function HabitCard({ habit, onToggle, onDelete, onEdit, disabled }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const size = getCardSize(habit.timeDuration)

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete(habit.id)
    } else {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
    }
  }

  // ── SMALL card (no duration) ─────────────────────────────
  if (size === 'small') {
    return (
      <div
        className={`${styles.card} ${styles.cardSmall} ${habit.doneToday ? styles.done : ''} ${disabled ? styles.disabled : ''}`}
        style={{ '--habit-color': habit.color }}
      >
        <div className={styles.smallLeft}>
          <span className={styles.emojiSm}>{habit.emoji}</span>
          <div className={styles.smallInfo}>
            <h3 className={styles.nameSm}>{habit.name}</h3>
            <div className={styles.smallMeta}>
              {habit.timeStart && (
                <span className={styles.timePill}>
                  🕐 {habit.timeStart}{habit.timeEnd ? ` – ${habit.timeEnd}` : ''}
                </span>
              )}
              <span className={`${styles.timePill} ${styles.xpPill}`}>⭐ {habit.xp}</span>
            </div>
          </div>
        </div>
        <div className={styles.smallRight}>
          <div className={styles.cardActions}>
            <button className={styles.editBtn} onClick={() => onEdit(habit)} title="Editar">✏️</button>
            <button
              className={`${styles.deleteBtn} ${confirmDelete ? styles.confirm : ''}`}
              onClick={handleDelete}
            >{confirmDelete ? '?' : '🗑️'}</button>
          </div>
          <CheckButton done={habit.doneToday} onToggle={() => !disabled && onToggle(habit.id)} />
        </div>
      </div>
    )
  }

  // ── MEDIUM card (≤ 60 min) ───────────────────────────────
  if (size === 'medium') {
    return (
      <div
        className={`${styles.card} ${styles.cardMedium} ${habit.doneToday ? styles.done : ''} ${disabled ? styles.disabled : ''}`}
        style={{ '--habit-color': habit.color }}
      >
        <div className={styles.cardActions}>
          <button className={styles.editBtn} onClick={() => onEdit(habit)} title="Editar">✏️</button>
          <button
            className={`${styles.deleteBtn} ${confirmDelete ? styles.confirm : ''}`}
            onClick={handleDelete}
          >{confirmDelete ? 'Confirmar?' : '🗑️'}</button>
        </div>

        <div className={styles.top}>
          <div className={styles.info}>
            <span className={styles.emoji}>{habit.emoji}</span>
            <div>
              <h3 className={styles.name}>{habit.name}</h3>
            </div>
          </div>
          <CheckButton done={habit.doneToday} onToggle={() => !disabled && onToggle(habit.id)} />
        </div>

        <Badges habit={habit} />
        <WeekGrid weekDays={habit.weekDays} color={habit.color} />
      </div>
    )
  }

  // ── LARGE card (> 60 min) ────────────────────────────────
  return (
    <div
      className={`${styles.card} ${styles.cardLarge} ${habit.doneToday ? styles.done : ''} ${disabled ? styles.disabled : ''}`}
      style={{ '--habit-color': habit.color }}
    >
      <div className={styles.cardActions}>
        <button className={styles.editBtn} onClick={() => onEdit(habit)} title="Editar">✏️</button>
        <button
          className={`${styles.deleteBtn} ${confirmDelete ? styles.confirm : ''}`}
          onClick={handleDelete}
        >{confirmDelete ? 'Confirmar?' : '🗑️'}</button>
      </div>

      <div className={styles.largeTop}>
        <span className={styles.emojiLg}>{habit.emoji}</span>
        <div className={styles.largeInfo}>
          <h3 className={styles.nameLg}>{habit.name}</h3>
        </div>
        <CheckButton done={habit.doneToday} onToggle={() => !disabled && onToggle(habit.id)} large />
      </div>

      <Badges habit={habit} />

      <WeekGrid weekDays={habit.weekDays} color={habit.color} />
    </div>
  )
}
