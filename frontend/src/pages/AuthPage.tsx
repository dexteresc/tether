import { observer } from 'mobx-react-lite'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useRootStore } from '../stores/RootStore'

export const AuthPage = observer(function AuthPage() {
  const { auth } = useRootStore()
  const navigate = useNavigate()
  const location = useLocation()

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const redirectTo = useMemo(() => {
    const state = location.state as { from?: { pathname?: string } } | null
    return state?.from?.pathname ?? '/'
  }, [location.state])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (mode === 'signup') {
        await auth.signUp(email, password, name)
      } else {
        await auth.signIn(email, password)
      }
      navigate(redirectTo, { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '40px auto', padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>Tether</h1>
      <p style={{ marginTop: 0, color: '#6b7280' }}>{mode === 'signup' ? 'Create an account' : 'Sign in'}</p>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>

        {mode === 'signup' ? (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} type="text" required />
          </label>
        ) : null}

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Password</span>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </label>

        <button disabled={submitting || auth.loading} type="submit">
          {submitting ? 'Working…' : mode === 'signup' ? 'Sign up' : 'Sign in'}
        </button>

        <button
          type="button"
          onClick={() => setMode((m) => (m === 'signin' ? 'signup' : 'signin'))}
          style={{ background: 'transparent', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}
        >
          {mode === 'signup' ? 'Have an account? Sign in' : 'Need an account? Sign up'}
        </button>

        {auth.lastError ? <div style={{ color: '#b91c1c' }}>{auth.lastError}</div> : null}
      </form>
    </div>
  )
})

