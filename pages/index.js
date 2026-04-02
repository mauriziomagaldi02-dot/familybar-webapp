import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user || null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (!user) {
    return (
      <div style={pageStyle}>
        <div style={loginWrapStyle}>
          <div style={loginCardStyle}>
            <div style={logoWrapStyle}>
              <img src="/logo.png" alt="logo" style={logoLoginStyle} />
            </div>

            <form onSubmit={handleLogin} style={formStyle}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />

              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
              />

              <button type="submit" style={primaryButtonStyle}>
                Accedi
              </button>
            </form>

            {message && <p style={errorTextStyle}>{message}</p>}
          </div>
        </div>
      </div>
    )
  }

  return <Layout onLogout={handleLogout} />
}

const pageStyle = {
  minHeight: '100vh',
  background: '#f6f7f9',
  fontFamily: 'Arial, sans-serif',
}

const loginWrapStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
}

const loginCardStyle = {
  width: '100%',
  maxWidth: 420,
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 18,
  padding: 32,
  boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
}

const logoWrapStyle = {
  marginBottom: 28,
  textAlign: 'center',
}

const logoLoginStyle = {
  height: 70,
  width: 'auto',
  objectFit: 'contain',
}

const formStyle = {
  display: 'grid',
  gap: 14,
}

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  border: '1px solid #d1d5db',
  borderRadius: 12,
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
}

const primaryButtonStyle = {
  padding: '12px',
  border: 'none',
  borderRadius: 12,
  background: '#111827',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 15,
  fontWeight: 600,
}

const errorTextStyle = {
  marginTop: 16,
  color: '#b91c1c',
}
