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

  // 🔴 LOGIN (SOLO LOGO)
  if (!user) {
    return (
      <div style={pageStyle}>
        <div style={loginWrapStyle}>
          <div style={loginCardStyle}>

            <div style={{ marginBottom: 28, textAlign: 'center' }}>
              <img
                src="/logo.png"
                alt="logo"
                style={{
                  height: 70,
                  objectFit: 'contain'
                }}
              />
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

  // 🔵 HOME
  return (
    <div style={pageStyle}>
      <div style={containerStyle}>

        <div style={topBarStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>

            <img
              src="/logo.png"
              alt="logo"
              style={{
                height: 40,
                objectFit: 'contain'
              }}
            />

            <div>
              <h1 style={titleStyle}>Familybar</h1>
              <p style={subtitleStyle}>
                Accesso effettuato come: {user.email}
              </p>
            </div>

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

/* STILI */

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
  fontSize: 28,
  color: '#111827',
}

const subtitleStyle = {
  margin: '6px 0 0 0',
  color: '#6b7280',
  fontSize: 14,
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
}

const primaryButtonStyle = {
  padding: '12px',
  border: 'none',
  borderRadius: 12,
  background: '#111827',
  color: '#fff',
  cursor: 'pointer',
}

const logoutButtonStyle = {
  padding: '10px 14px',
  border: '1px solid #d1d5db',
  borderRadius: 12,
  background: '#fff',
  cursor: 'pointer',
}

const errorTextStyle = {
  marginTop: 16,
  color: '#b91c1c',
}

const emptyTextStyle = {
  color: '#6b7280',
}

const pvListStyle = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'grid',
  gap: 10,
}

const pvItemStyle = {
  padding: '10px',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
}

const menuLinkStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '12px',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  textDecoration: 'none',
  color: '#111827',
}

const menuArrowStyle = {
  color: '#6b7280',
}
