import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState(null)
  const [pointsOfSale, setPointsOfSale] = useState([])
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

  useEffect(() => {
    if (user) loadPointsOfSale()
  }, [user])

  async function loadPointsOfSale() {
    const { data, error } = await supabase
      .from('points_of_sale')
      .select('*')
      .order('name')

    if (error) {
      setMessage(error.message)
      return
    }

    setPointsOfSale(data || [])
  }

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
            <div style={{ marginBottom: 28 }}>
              <h1 style={titleStyle}>Familybar</h1>
              <p style={subtitleStyle}>Accesso gestionale</p>
            </div>

            <form onSubmit={handleLogin} style={{ display: 'grid', gap: 14 }}>
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

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div style={topBarStyle}>
          <div>
            <h1 style={titleStyle}>Familybar Web App</h1>
            <p style={subtitleStyle}>Accesso effettuato come: {user.email}</p>
          </div>

          <button onClick={handleLogout} style={logoutButtonStyle}>
            Esci
          </button>
        </div>

        {message && <p style={errorTextStyle}>{message}</p>}

        <div style={gridStyle}>
          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Punti vendita</h2>

            {pointsOfSale.length === 0 ? (
              <p style={emptyTextStyle}>Nessun punto vendita presente.</p>
            ) : (
              <ul style={pvListStyle}>
                {pointsOfSale.map((pv) => (
                  <li key={pv.id} style={pvItemStyle}>
                    {pv.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Menu</h2>

            <div style={linksGridStyle}>
              <MenuLink href="/fatture" label="Fatture" />
              <MenuLink href="/ricavi" label="Ricavi" />
              <MenuLink href="/costi-personale" label="Costi personale" />
              <MenuLink href="/spese-manuali" label="Spese manuali" />
              <MenuLink href="/dashboard" label="Dashboard" />
              <MenuLink href="/mappature" label="Mappature fornitori" />
              <MenuLink href="/import-xml" label="Import XML" />
              <MenuLink href="/fornitori" label="Fornitori" />
              <MenuLink href="/analisi" label="Analisi avanzata" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MenuLink({ href, label }) {
  return (
    <Link href={href} style={menuLinkStyle}>
      <span>{label}</span>
      <span style={menuArrowStyle}>→</span>
    </Link>
  )
}

const pageStyle = {
  minHeight: '100vh',
  background: '#f6f7f9',
  fontFamily: 'Arial, sans-serif',
}

const containerStyle = {
  maxWidth: 1200,
  margin: '0 auto',
  padding: '32px 24px 48px',
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
  borderRadius: 16,
  padding: 32,
  boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
}

const topBarStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  marginBottom: 24,
  flexWrap: 'wrap',
}

const cardStyle = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 16,
  padding: 24,
  boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
}

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1.4fr',
  gap: 24,
}

const linksGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
}

const titleStyle = {
  margin: 0,
  fontSize: 32,
  lineHeight: 1.1,
  color: '#111827',
}

const subtitleStyle = {
  margin: '8px 0 0 0',
  color: '#6b7280',
  fontSize: 15,
}

const sectionTitleStyle = {
  margin: '0 0 18px 0',
  fontSize: 20,
  color: '#111827',
}

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  border: '1px solid #d1d5db',
  borderRadius: 12,
  fontSize: 15,
  outline: 'none',
  background: '#fff',
}

const primaryButtonStyle = {
  padding: '12px 16px',
  border: 'none',
  borderRadius: 12,
  background: '#111827',
  color: '#ffffff',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
}

const logoutButtonStyle = {
  padding: '12px 16px',
  border: '1px solid #d1d5db',
  borderRadius: 12,
  background: '#ffffff',
  color: '#111827',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
}

const errorTextStyle = {
  marginTop: 16,
  color: '#b91c1c',
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: 12,
  padding: '10px 12px',
  fontSize: 14,
}

const emptyTextStyle = {
  margin: 0,
  color: '#6b7280',
  fontSize: 15,
}

const pvListStyle = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'grid',
  gap: 10,
}

const pvItemStyle = {
  padding: '12px 14px',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  background: '#f9fafb',
  color: '#111827',
  fontSize: 15,
}

const menuLinkStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '14px 16px',
  border: '1px solid #e5e7eb',
  borderRadius: 14,
  background: '#ffffff',
  color: '#111827',
  textDecoration: 'none',
  fontSize: 15,
  fontWeight: 600,
  transition: 'all 0.15s ease',
}

const menuArrowStyle = {
  color: '#6b7280',
  fontSize: 16,
}
