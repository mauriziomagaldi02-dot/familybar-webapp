import { supabase } from '../lib/supabaseClient'

export default function Header() {
  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div style={headerStyle}>
      <div style={leftStyle}>
        <img src="/logo.png" style={logoStyle} />
        <span style={titleStyle}>Business Analytics</span>
      </div>

      <button onClick={handleLogout} style={buttonStyle}>
        Logout
      </button>
    </div>
  )
}

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px 24px',
  background: '#ffffff',
  borderBottom: '1px solid #e5e7eb',
}

const leftStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
}

const logoStyle = {
  height: 40,
}

const titleStyle = {
  fontSize: 20,
  fontWeight: 700,
}

const buttonStyle = {
  padding: '8px 12px',
  border: 'none',
  borderRadius: 8,
  background: '#111827',
  color: '#fff',
  cursor: 'pointer',
}
