import Link from 'next/link'
import Header from './Header'

const menuItems = [
  { href: '/', label: 'Home' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/analisi', label: 'Analisi avanzata' },
  { href: '/fatture', label: 'Fatture' },
  { href: '/ricavi', label: 'Ricavi' },
  { href: '/costi-personale', label: 'Costi personale' },
  { href: '/spese-manuali', label: 'Spese manuali' },
  { href: '/import-xml', label: 'Import XML' },
  { href: '/mappature', label: 'Mappature fornitori' },
  { href: '/fornitori', label: 'Fornitori' },
]

export default function Layout({ children, onLogout, hideMenu = false, compactMenu = false }) {
}) {
  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <Header onLogout={onLogout} />

        {!hideMenu && (
  <div style={compactMenu ? compactMenuStyle : menuSectionStyle}>
    {menuItems.map((item) => (
      compactMenu ? (
        <Link key={item.href} href={item.href} style={compactLinkStyle}>
          {item.label}
        </Link>
      ) : (
        <MenuLink
          key={item.href}
          href={item.href}
          label={item.label}
          icon={item.icon}
          note={item.note}
        />
      )
    ))}
  </div>
)}
        <div style={contentCardStyle}>{children}</div>
      </div>
    </div>
  )
}

function MenuCard({ href, label }) {
  return (
    <Link href={href} style={menuCardStyle}>
      <div style={menuCardTitleStyle}>{label}</div>
    </Link>
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

const menuSectionStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 16,
  marginBottom: 24,
}

const menuCardStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 72,
  padding: 18,
  border: '1px solid #e5e7eb',
  borderRadius: 16,
  background: '#ffffff',
  textDecoration: 'none',
  color: '#111827',
  boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
  fontWeight: 700,
}

const menuCardTitleStyle = {
  fontSize: 16,
  textAlign: 'center',
}

const compactMenuWrapStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginBottom: 18,
}

const compactMenuLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '7px 10px',
  border: '1px solid #d1d5db',
  borderRadius: 999,
  background: '#ffffff',
  textDecoration: 'none',
  color: '#374151',
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1,
}

const contentCardStyle = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 18,
  padding: 24,
  boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
}

const compactMenuStyle = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
  marginBottom: 20,
}

const compactLinkStyle = {
  fontSize: 13,
  padding: '6px 10px',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  background: '#fff',
  textDecoration: 'none',
  color: '#111827',
}
