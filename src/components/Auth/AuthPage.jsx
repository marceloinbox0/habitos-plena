import { useState } from 'react'
import styles from './AuthPage.module.css'

export default function AuthPage({ signIn, signUp }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) setError('E-mail ou senha incorretos.')
    } else {
      const { error } = await signUp(email, password)
      if (error) {
        setError(error.message.includes('already') ? 'Este e-mail já está cadastrado.' : error.message)
      } else {
        setSuccess('Conta criada! Verifique seu e-mail para confirmar.')
      }
    }
    setLoading(false)
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>✨</span>
          <h1 className={styles.logoTitle}>VidaPlena</h1>
        </div>
        <p className={styles.subtitle}>Sua rotina ajustada para a Vitória</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              autoFocus
            />
          </div>
          <div className={styles.field}>
            <label>Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
            {mode === 'signup' && (
              <span className={styles.hint}>Mínimo 6 caracteres</span>
            )}
          </div>

          {error && <div className={styles.error}>{error}</div>}
          {success && <div className={styles.successMsg}>{success}</div>}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? '...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <div className={styles.toggle}>
          {mode === 'login' ? (
            <>Não tem conta?{' '}
              <button onClick={() => { setMode('signup'); setError(null); setSuccess(null) }}>
                Cadastre-se
              </button>
            </>
          ) : (
            <>Já tem conta?{' '}
              <button onClick={() => { setMode('login'); setError(null); setSuccess(null) }}>
                Entrar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
