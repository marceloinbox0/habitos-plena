import { useMemo, useState } from 'react'
import styles from './HistoryView.module.css'

function formatDateLocal(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDayLabel(dateStr) {
  try {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    return days[new Date(dateStr + 'T12:00:00').getDay()]
  } catch (e) {
    return '???'
  }
}

function getExpectedHabitsForDate(dateStr, habits, daysOff, dayOffHabits) {
  const d = new Date(dateStr + "T12:00:00")
  const dayOfWeek = d.getDay()
  const isDayOff = (dayOfWeek === 6 && daysOff?.saturday) || (dayOfWeek === 0 && daysOff?.sunday)

  return (habits || []).filter(h => {
    // Se o hábito foi criado depois dessa data
    if (h.created_at && formatDateLocal(h.created_at) > dateStr) return false
    
    // Se o hábito já estava arquivado
    if (h.archived && h.archived_at && formatDateLocal(h.archived_at) <= dateStr) return false
    
    // Se é dia de folga e não foi selecionado
    if (isDayOff && dayOffHabits) {
      if (dayOfWeek === 6 && dayOffHabits.saturday && !dayOffHabits.saturday.includes(h.id)) return false
      if (dayOfWeek === 0 && dayOffHabits.sunday && !dayOffHabits.sunday.includes(h.id)) return false
      if (Array.isArray(dayOffHabits) && !dayOffHabits.includes(h.id)) return false
    }
    
    return true
  })
}

function getDailyStats(habits = [], completions = [], summaries = [], daysOff = {}, dayOffHabits = [], daysCount = 7) {
  const stats = []
  const today = new Date()
  
  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = formatDateLocal(d)
    
    // Tenta pegar o resumo salvo (snapshot)
    const saved = (summaries || []).find(s => s.summary_date === dateStr)
    
    let percentage = 0
    let totalXPEarned = 0
    let totalXPExpected = 0

    if (saved) {
      totalXPEarned = saved.completed_xp
      totalXPExpected = saved.total_xp
      percentage = totalXPExpected > 0 ? Math.round((totalXPEarned / totalXPExpected) * 100) : 0
    } else {
      // Cálculo dinâmico se não houver snapshot
      const existingHabits = getExpectedHabitsForDate(dateStr, habits, daysOff, dayOffHabits)
      
      totalXPExpected = existingHabits.reduce((acc, h) => acc + (Number(h.xp) || 10), 0)
      totalXPEarned = (completions || [])
        .filter(c => c.completed_date === dateStr)
        .reduce((acc, c) => acc + (Number(c.xp_earned) || 0), 0)
      
      const dayOfWeek = new Date(dateStr + "T12:00:00").getDay()
      const isDayOff = (dayOfWeek === 6 && daysOff?.saturday) || (dayOfWeek === 0 && daysOff?.sunday)

      // Só conta como dia de folga válido se havia hábitos cadastrados nessa data
      const hadHabits = (habits || []).some(h => !h.created_at || formatDateLocal(h.created_at) <= dateStr)
      percentage = totalXPExpected > 0 ? Math.round((totalXPEarned / totalXPExpected) * 100) : (isDayOff && hadHabits ? 100 : 0)
    }
      
    stats.push({
      date: dateStr,
      label: getDayLabel(dateStr),
      percentage: Math.min(100, Math.max(0, percentage)),
      count: totalXPEarned,
      total: totalXPExpected
    })
  }
  return stats
}

function LineChart({ data = [] }) {
  if (!data || data.length === 0) return <div className={styles.noData}>Sem dados para o gráfico</div>

  const width = 300
  const height = 120
  const padding = 25
  
  const points = data.map((d, i) => {
    const x = padding + (i * (width - padding * 2) / Math.max(1, data.length - 1))
    const p = isNaN(d.percentage) ? 0 : d.percentage
    const y = height - padding - (p / 100 * (height - padding * 2))
    return { x, y }
  })
  
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaD = `${pathD} L ${points[points.length-1].x} ${height-padding} L ${points[0].x} ${height-padding} Z`

  return (
    <div className={styles.chartContainer}>
      <svg viewBox={`0 0 ${width} ${height}`} className={styles.svg}>
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {[0, 50, 100].map(v => {
          const y = height - padding - (v / 100 * (height - padding * 2))
          return <line key={v} x1={padding} y1={y} x2={width-padding} y2={y} className={styles.gridLine} />
        })}

        <path d={areaD} className={styles.area} />
        <path d={pathD} className={styles.line} />
        
        {points.map((p, i) => (
          <g key={i} className={styles.pointGroup}>
            <circle cx={p.x} cy={p.y} r="3" className={styles.point} fill="var(--accent)" />
            <text x={p.x} y={height - 5} textAnchor="middle" className={styles.axisText}>{data[i].label}</text>
            <text x={p.x} y={p.y - 8} textAnchor="middle" className={styles.pointText}>{data[i].percentage}%</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function Calendar({ habits = [], completions = [], summaries = [], daysOff = {}, dayOffHabits = [], minMonth = null }) {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  // offset em meses em relação ao mês atual (0 = agora, -1 = mês passado…)
  const [offset, setOffset] = useState(0)

  const viewDate = new Date(currentYear, currentMonth + offset, 1)
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  // Mês mínimo navegável
  const minDate = minMonth ? new Date(minMonth + '-01') : new Date(currentYear, currentMonth, 1)
  const minYear = minDate.getFullYear()
  const minMon = minDate.getMonth()

  const canGoPrev = year > minYear || (year === minYear && month > minMon)
  const canGoNext = offset < 0  // só pode avançar se não está no mês atual

  // Quantos dias do mês já passaram (incluindo hoje)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const isCurrentMonth = year === currentYear && month === currentMonth
  const daysPassed = isCurrentMonth
    ? now.getDate()       // hoje incluído
    : daysInMonth         // mês passado = todos os dias passaram
  const percentElapsed = Math.round((daysPassed / daysInMonth) * 100)

  const firstDay = new Date(year, month, 1).getDay()
  const calendarDays = []
  for (let i = 0; i < firstDay; i++) calendarDays.push(null)
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i)

  const todayStr = formatDateLocal(now)

  return (
    <div className={styles.calendar}>
      {/* Cabeçalho de navegação */}
      <div className={styles.calMonthNav}>
        <button
          className={styles.calNavBtn}
          onClick={() => setOffset(o => o - 1)}
          disabled={!canGoPrev}
          aria-label="Mês anterior"
        >‹</button>

        <div className={styles.calMonthInfo}>
          <span className={styles.calMonthName}>{MONTH_NAMES[month]} {year}</span>
          <span className={styles.calElapsed}>{percentElapsed}% dos dias passados</span>
        </div>

        <button
          className={styles.calNavBtn}
          onClick={() => setOffset(o => o + 1)}
          disabled={!canGoNext}
          aria-label="Próximo mês"
        >›</button>
      </div>

      {/* Labels dos dias da semana */}
      <div className={styles.calendarHeader}>
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
          <span key={i} className={styles.calDayLabel}>{d}</span>
        ))}
      </div>

      <div className={styles.calendarGrid}>
        {calendarDays.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className={styles.calDayEmpty} />

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isToday = dateStr === todayStr
          const isFuture = dateStr > todayStr

          const saved = (summaries || []).find(s => s.summary_date === dateStr)
          let percent = 0
          let hasData = false

          if (saved) {
            percent = saved.total_xp > 0 ? Math.round((saved.completed_xp / saved.total_xp) * 100) : 0
            hasData = true
          } else {
            const existingOnDay = getExpectedHabitsForDate(dateStr, habits, daysOff, dayOffHabits)
            const totalXPExpected = existingOnDay.reduce((acc, h) => acc + (Number(h.xp) || 10), 0)
            const totalXPEarned = (completions || [])
              .filter(c => c.completed_date === dateStr)
              .reduce((acc, c) => acc + (Number(c.xp_earned) || 0), 0)

            const dayOfWeek = new Date(dateStr + 'T12:00:00').getDay()
            const isDayOff = (dayOfWeek === 6 && daysOff?.saturday) || (dayOfWeek === 0 && daysOff?.sunday)

            // Só conta como dia de folga válido se havia hábitos cadastrados nessa data
            const hadHabits = (habits || []).some(h => !h.created_at || formatDateLocal(h.created_at) <= dateStr)
            percent = totalXPExpected > 0 ? Math.round((totalXPEarned / totalXPExpected) * 100) : (isDayOff && hadHabits ? 100 : 0)
            hasData = totalXPExpected > 0 || (isDayOff && hadHabits)
          }

          const showBar = !isFuture && hasData

          let statusClass = ''
          if (!isFuture && percent >= 90) statusClass = styles.calSuccess
          else if (!isFuture && percent >= 80) statusClass = styles.calWarning

          return (
            <div
              key={day}
              className={`${styles.calDay} ${isToday ? styles.calToday : ''} ${isFuture ? styles.calFuture : ''} ${statusClass}`}
            >
              <span className={styles.calDayNum}>{day}</span>
              {showBar && (
                <div className={styles.calPercentBar}>
                  <div className={styles.calPercentFill} style={{ width: `${Math.min(100, percent)}%` }} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CoachSection({ habits = [], completions = [], summaries = [], last7Days = [] }) {
  const avgXP = useMemo(() => {
    if (last7Days.length === 0) return 0
    const sum = last7Days.reduce((acc, d) => acc + d.percentage, 0)
    return Math.round(sum / last7Days.length)
  }, [last7Days])

  const insight = useMemo(() => {
    const dailyInspirations = [
      { quote: "Não existe vitória sem disciplina, nem virtude sem obediência.", author: "Santo Inácio de Loyola", verseText: "Então, em visão falaste do teu santo e disseste: Socorri um que é esforçado; exaltei a um eleito do povo", verseRef: "Salmo 89:19" },
      { quote: "O hábito é o servo de bons mestres.", author: "Santo Agostinho", verseText: "Tudo posso naquele que me fortalece.", verseRef: "Filipenses 4:13" },
      { quote: "A perseverança é a virtude pela qual todas as outras virtudes dão frutos.", author: "Santa Teresa d'Ávila", verseText: "Seja forte e corajoso! Não desanime, pois o Senhor, o seu Deus, estará com você.", verseRef: "Josué 1:9" },
      { quote: "Ocupe-se com Deus e Ele se ocupará de você.", author: "São Pio de Pietrelcina", verseText: "O Senhor é o meu pastor, nada me faltará.", verseRef: "Salmo 23:1" },
      { quote: "A disciplina é a ponte entre metas e conquistas.", author: "C.S. Lewis", verseText: "Quem é fiel no pouco, também é fiel no muito.", verseRef: "Lucas 16:10" },
      { quote: "A oração é a respiração da alma.", author: "São Gregório de Nissa", verseText: "Alegrai-vos na esperança, sede pacientes na tribulação, perseverai na oração.", verseRef: "Romanos 12:12" },
      { quote: "O tempo é um presente; o que fazemos com ele é nossa oferta a Deus.", author: "São Boaventura", verseText: "Não vos conformeis com este mundo, mas transformai-vos pela renovação da vossa mente.", verseRef: "Romanos 12:2" },
      { quote: "Comece fazendo o que é necessário, depois o que é possível.", author: "São Francisco de Assis", verseText: "Consagre ao Senhor tudo o que você faz, e os seus planos serão bem-sucedidos.", verseRef: "Provérbios 16:3" },
      { quote: "A paciência tudo alcança.", author: "Santa Teresa de Jesus", verseText: "Guarde o seu coração, pois dele dependem as fontes da vida.", verseRef: "Provérbios 4:23" },
      { quote: "O trabalho nas mãos é a melhor oração.", author: "São Bento",  verseText: "E não nos cansemos de fazer o bem, pois no tempo próprio colheremos.", verseRef: "Gálatas 6:9" },
      { quote: "A santidade consiste em estar sempre alegre.", author: "São João Bosco", verseText: "Pois Deus não nos deu espírito de covardia, mas de poder, de amor e de equilíbrio.", verseRef: "2 Timóteo 1:7" },
      { quote: "Fazei tudo com amor.", author: "São João da Cruz", verseText: "Todas as vossas coisas sejam feitas com amor.", verseRef: "1 Coríntios 16:14" },
      { quote: "A humildade é a base de todas as virtudes.", author: "São Cipriano", verseText: "Buscai primeiro o Reino de Deus e a sua justiça.", verseRef: "Mateus 6:33" },
      { quote: "Amar a Deus e ao próximo é a verdadeira sabedoria.", author: "Tomás de Aquino", verseText: "O amor é paciente, o amor é bondoso.", verseRef: "1 Coríntios 13:4" },
      { quote: "Não devemos desanimar quando não conseguimos cumprir nossos propósitos; a constância se faz ao levantar e tentar de novo.", author: "São Francisco de Sales", verseText: "A alegria do Senhor é a nossa força.", verseRef: "Neemias 8:10" },
      { quote: "Faz o que deves, e está no que fazes.", author: "São Josemaria Escrivá", verseText: "Tudo o que fizerem, façam de todo o coração, como para o Senhor.", verseRef: "Colossenses 3:23" },
      { quote: "A virtude é a ordem do amor.", author: "Santo Agostinho", verseText: "Sirvam ao Senhor com alegria; apresentem-se a ele com cânticos.", verseRef: "Salmo 100:2" },
      { quote: "A verdadeira obediência obedece rapidamente.", author: "São Bernardo de Claraval", verseText: "Portanto, quem ouve estas minhas palavras e as pratica é como um homem prudente.", verseRef: "Mateus 7:24" },
      { quote: "Esforça-te e faz bem tudo o que tens a fazer.", author: "Santo Inácio", verseText: "Tudo tem o seu tempo determinado, e há tempo para todo o propósito.", verseRef: "Eclesiastes 3:1" },
      { quote: "Não deixe para focar e se sacrificar amanha; entregue o agora a Deus.", author: "Papa João Paulo II", verseText: "Deem graças em todas as circunstâncias.", verseRef: "1 Tessalonicenses 5:18" },
      { quote: "O verdadeiro progresso é invisível, se constrói nas rotinas de silêncio e repetição fiel.", author: "Thomas Merton", verseText: "Sê fiel até a morte, e dar-te-ei a coroa da vida.", verseRef: "Apocalipse 2:10" },
      { quote: "A paz é a tranquilidade da ordem.", author: "Santo Agostinho", verseText: "O Senhor te guiará continuamente, e fartará a tua alma em lugares áridos.", verseRef: "Isaías 58:11" },
      { quote: "A pressa é inimiga da perfeição, mas a constância é sua mãe.", author: "São Vicente de Paulo", verseText: "Estou plenamente certo de que aquele que começou boa obra em vós há de completá-la.", verseRef: "Filipenses 1:6" },
      { quote: "Quando não se pode muito, contenta-se o Senhor com algo de pouco.", author: "Santa Teresa", verseText: "A esperança não nos decepciona.", verseRef: "Romanos 5:5" },
      { quote: "Nas pequenas obras, vê-se a grandiosidade de um grande amor.", author: "Santa Teresinha do Menino Jesus", verseText: "Permanecei em mim, e eu permanecerei em vós.", verseRef: "João 15:4" },
      { quote: "Lembre-se de sua finalidade eterna ao executar tarefas rotineiras.", author: "São Tomás More", verseText: "Buscai as coisas lá do alto, onde Cristo vive.", verseRef: "Colossenses 3:1" },
      { quote: "Somente a obediência e a dedicação formam o verdadeiro servo.", author: "Santo Antônio", verseText: "Ensina-nos a contar os nossos dias, para que alcancemos coração sábio.", verseRef: "Salmo 90:12" },
      { quote: "Quem não luta, não é coroado.", author: "São João Crisóstomo", verseText: "A vossa bondade seja conhecida de todos os homens.", verseRef: "Filipenses 4:5" },
      { quote: "Para seguir o caminho certo, é preciso primeiro saber para onde se vai.", author: "São Tomás de Aquino", verseText: "Feliz o homem que acha sabedoria.", verseRef: "Provérbios 3:13" },
      { quote: "Sem sacrifício não pode haver amor a Deus.", author: "Maximilian Kolbe", verseText: "Nós o amamos a ele porque ele nos amou primeiro.", verseRef: "1 João 4:19" },
      { quote: "Coloque Deus no topo de seus afazeres e tudo o mais será produtivo.", author: "Madre Teresa de Calcutá", verseText: "Buscai o Senhor enquanto se pode achar.", verseRef: "Isaías 55:6" }
    ]
    
    // Escolhe uma frase/versículo baseada no dia do mês (1-31)
    const dayOfMonth = new Date().getDate()
    const dailyInspiration = dailyInspirations[(dayOfMonth - 1) % dailyInspirations.length]

    let coachAdvice = ""
    if (avgXP < 40) {
      coachAdvice = "Atenção: Seu ritmo de produtividade caiu. A procrastinação nos afasta dos nossos chamados. Foque em recuperar a disciplina hoje."
    } else if (avgXP >= 85) {
      coachAdvice = "Excelente produtividade! Sua constância e obediência aos seus propósitos estão magníficas e exemplares. Continue fiel, exercitando suas virtudes, e executando seus afazeres para buscar uma vida de excelência."
    } else {
      coachAdvice = "Você está com um bom ritmo, mantendo a produtividade diária em nível satisfatório. Continue firme - a obediência fiel e rotineira nos hábitos constrói uma mente focada e grandes conquistas com o tempo."
    }

    return { coachAdvice, dailyInspiration }
  }, [avgXP])

  return (
    <div className={styles.coachCard}>
      <div className={styles.coachIcon}>🕊️</div>
      <div className={styles.coachContent}>
        <p className={styles.coachAdvice}>{insight.coachAdvice}</p>
        
        <div className={styles.quoteBox}>
          <p className={styles.quoteText}>"{insight.dailyInspiration.quote}"</p>
          <span className={styles.quoteAuthor}>— {insight.dailyInspiration.author}</span>
        </div>

        <div className={styles.quoteBox} style={{ marginTop: '0.8rem', background: 'rgba(255,255,255,0.02)' }}>
          <p className={styles.quoteText} style={{ fontStyle: 'italic', color: '#93c5fd' }}>"{insight.dailyInspiration.verseText}"</p>
          <span className={styles.quoteAuthor} style={{ color: '#60a5fa' }}>— {insight.dailyInspiration.verseRef}</span>
        </div>
      </div>
    </div>
  )
}

export default function HistoryView({ habits = [], completions = [], summaries = [], daysOff = {}, dayOffHabits = [] }) {
  const last7Days = useMemo(() => getDailyStats(habits, completions, summaries, daysOff, dayOffHabits, 7), [habits, completions, summaries, daysOff, dayOffHabits])

  // Mês mínimo navegável: mês do registro mais antigo (completion ou summary)
  const minMonth = useMemo(() => {
    const dates = [
      ...(completions || []).map(c => c.completed_date),
      ...(summaries || []).map(s => s.summary_date),
    ].filter(Boolean).sort()
    if (dates.length === 0) return null
    return dates[0].slice(0, 7) // 'YYYY-MM'
  }, [completions, summaries])

  return (
    <div className={styles.container}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Insight VidaPlena</h3>
        <CoachSection last7Days={last7Days} />
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Últimos 7 dias</h3>
        <LineChart data={last7Days} />
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Calendário Mensal</h3>
        <Calendar
          habits={habits}
          completions={completions}
          summaries={summaries}
          daysOff={daysOff}
          dayOffHabits={dayOffHabits}
          minMonth={minMonth}
        />
      </section>
    </div>
  )
}
