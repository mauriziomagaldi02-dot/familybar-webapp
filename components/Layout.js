import Header from './Header'

export default function Layout({ children, onLogout }) {
  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <Header onLogout={onLogout} />
        <div style={contentStyle}>
          {children}
        </div>
      </div>
    </div>
  )
}

const pageStyle = {
  minHeight: '100vh',
  background: '#f6f7f9',
  fontFamily: 'Arial, sans-serif',
}

const containerStyle = {
  maxWidth: 1240,
  margin: '0 auto',
  padding: '32px 24px 48px',
}

const contentStyle = {
  marginTop: 10,
}
