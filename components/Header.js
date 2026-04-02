export default function Header({ onLogout }) {
  return (
    <header style={headerStyle}>
      <div style={brandWrapStyle}>
        <img src="/logo.png" alt="logo" style={logoStyle} />
        <div style={titleStyle}>Business Analytics</div>
      </div>

      <button onClick={onLogout} style={logoutButtonStyle}>
        Logout
      </button>
    </header>
  )
}

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 24,
  padding: '16px 20px',
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 18,
  boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
}

const brandWrapStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
}

const logoStyle = {
  height: 42,
  width: 'auto',
  objectFit: 'contain',
  display: 'block',
}

const titleStyle = {
  fontSize: 22,
  fontWeight: 700,
  color: '#111827',
  letterSpacing: '-0.02em',
}

const logoutButtonStyle = {
  padding: '10px 16px',
  border: 'none',
  borderRadius: 12,
  background: '#111827',
  color: '#ffffff',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 600,
}
