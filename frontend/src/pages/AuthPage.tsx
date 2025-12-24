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
    <div className="max-w-[420px] mx-auto my-10 p-4">
      <h1 className="text-3xl font-bold mb-2">Tether</h1>
      <p className="mt-0 text-gray-500">{mode === 'signup' ? 'Create an account' : 'Sign in'}</p>

      <form onSubmit={onSubmit} className="flex flex-col gap-3 mt-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Email</span>
          <input className="border border-gray-300 rounded p-2" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>

        {mode === 'signup' ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Name</span>
            <input className="border border-gray-300 rounded p-2" value={name} onChange={(e) => setName(e.target.value)} type="text" required />
          </label>
        ) : null}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Password</span>
          <input className="border border-gray-300 rounded p-2" value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </label>

        <button className="bg-black text-white p-2 rounded hover:bg-gray-800 disabled:opacity-50 cursor-pointer" disabled={submitting || auth.loading} type="submit">
          {submitting ? 'Working…' : mode === 'signup' ? 'Sign up' : 'Sign in'}
        </button>

        <button
          type="button"
          onClick={() => setMode((m) => (m === 'signin' ? 'signup' : 'signin'))}
          className="bg-transparent border-none underline cursor-pointer text-sm text-gray-600 hover:text-black"
        >
          {mode === 'signup' ? 'Have an account? Sign in' : 'Need an account? Sign up'}
        </button>

        {auth.lastError ? <div className="text-red-700 text-sm">{auth.lastError}</div> : null}
      </form>
    </div>
  )
})

