import Link from 'next/link'

export default function Header({ onLogout }) {
  return (
    <div style={topBarStyle}>
      <div style={brandWrapStyle}>
        <img
          src="/logo.png"
          alt="logo"
          style={{
            height: 42,
            objectFit: 'contain',
          }}
        />

        <h1 style={titleStyle}>Business Analytics</h1>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <Link href="/" style={navLinkStyle}>Home</Link>
        <Link href="/dashboard" style={navLinkStyle}>Dashboard</Link>
        <Link href="/analisi" style={navLinkStyle}>Analisi</Link>

        {onLogout && (
          <button onClick={onLogout} style={logoutButtonStyle}>
            Esci
          </button>
        )}
      </div>
    </div>
  )
}

/* STILI */

const topBarStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 24,
  flexWrap: 'wrap',
}

const brandWrapStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
}

const titleStyle = {
  margin: 0,
  fontSize: 26,
  color: '#111827',
}

const navLinkStyle = {
  textDecoration: 'none',
  color: '#111827',
  fontWeight: 600,
  padding: '8px 10px',
  borderRadius: 8,
}

const logoutButtonStyle = {
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 10,
  background: '#fff',
  cursor: 'pointer',
}
