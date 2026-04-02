import Link from 'next/link'
import Header from './Header'

const menuItems = [
  { href: '/', label: 'Home', icon: '🏠', note: 'Panoramica generale' },
  { href: '/dashboard', label: 'Dashboard', icon: '📊', note: 'Sintesi mensile e semafori' },
  { href: '/analisi', label: 'Analisi avanzata', icon: '📈', note: 'Pareto, grafici e confronto dati' },
  { href: '/fatture', label: 'Fatture', icon: '🧾', note: 'Gestione acquisti e imponibili' },
  { href: '/ricavi', label: 'Ricavi', icon: '💶', note: 'Inserimento ricavi per PV' },
  { href: '/costi-personale', label: 'Costi personale', icon: '👥', note: 'Costo lavoro e ore' },
  { href: '/spese-manuali', label: 'Spese manuali', icon: '📝', note: 'Costi extra e costi generali' },
  { href: '/import-xml', label: 'Import XML', icon: '📂', note: 'Importazione FatturaPA' },
  { href: '/mappature', label: 'Mappature fornitori', icon: '🧩', note: 'Regole automatiche di assegnazione' },
  { href: '/fornitori', label: 'Fornitori', icon: '🏷️', note: 'Anagrafica, P.IVA e codice fiscale' },
  { href: '/categorie', label: 'Categorie', icon: '📚', note: 'Gestione categorie acquisti' },
]

export default function Layout({ children, onLogout, compactMenu = false }) {
  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <Header onLogout={onLogout} />

        {compactMenu ? (
          <div style={compactMenuStyle}>
            {menuItems.map((item) => (
              <Link key={item.href} href={item.href} style={compactLinkStyle}>
                {item.label}
              </Link>
            ))}
          </div>
        ) : (
          <div style={menuSectionStyle}>
            {menuItems.map((item) => (
              <MenuCard
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                note={item.note}
              />
            ))}
          </div>
        )}

        {children ? <div style={contentCardStyle}>{children}</div> : null}
      </div>
    </div>
  )
}

function MenuCard({ href, label, icon, note }) {
  return (
    <Link href={href} style={menuCardStyle}>
      <div style={menuTopRowStyle}>
        <div style={menuIconStyle}>{icon}</div>
        <div style={menuArrowStyle}>→</div>
      </div>

      <div>
        <div style={menuTitleStyle}>{label}</div>
        <div style={menuNoteStyle}>{note}</div>
      </div>
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
  flexDirection: 'column',
  justifyContent: 'space-between',
  minHeight: 120,
  padding: 18,
  border: '1px solid #e5e7eb',
  borderRadius: 16,
  background: '#ffffff',
  textDecoration: 'none',
  color: '#111827',
  boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
}

const menuTopRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 18,
}

const menuIconStyle = {
  width: 40,
  height: 40,
  borderRadius: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f3f4f6',
  fontSize: 20,
}

const menuArrowStyle = {
  color: '#9ca3af',
  fontSize: 20,
  fontWeight: 700,
}

const menuTitleStyle = {
  fontSize: 17,
  fontWeight: 700,
  color: '#111827',
  marginBottom: 6,
}

const menuNoteStyle = {
  fontSize: 13,
  color: '#6b7280',
  lineHeight: 1.4,
}

const compactMenuStyle = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  marginBottom: 20,
}

const compactLinkStyle = {
  fontSize: 12,
  padding: '6px 10px',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  background: '#ffffff',
  textDecoration: 'none',
  color: '#111827',
}

const contentCardStyle = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 18,
  padding: 24,
  boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
}
