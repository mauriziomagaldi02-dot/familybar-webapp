import Layout from '../components/Layout'
import { supabase } from '../lib/supabaseClient'

export default function Dashboard() {
  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <Layout onLogout={handleLogout}>
      <PageIntro
        title="Dashboard"
        subtitle="Vista sintetica dei KPI principali, semafori e situazione mensile."
      />

      <div style={kpiGridStyle}>
        <KpiCard title="Ricavi" value="€ 0,00" note="Totale periodo selezionato" />
        <KpiCard title="Costi totali" value="€ 0,00" note="Diretti + generali + personale" />
        <KpiCard title="Margine" value="€ 0,00" note="Ricavi - costi totali" />
        <KpiCard title="Margine %" value="0,0%" note="Incidenza sul fatturato" />
      </div>

      <SectionCard title="Semafori">
        Area pronta per semafori automatici su produttività, margine e costo personale.
      </SectionCard>

      <SectionCard title="Filtro PV">
        Qui inserirai il filtro globale per punto vendita, mese e periodo.
      </SectionCard>
    </Layout>
  )
}

function PageIntro({ title, subtitle }) {
  return (
    <div style={introStyle}>
      <h1 style={titleStyle}>{title}</h1>
      <p style={subtitleStyle}>{subtitle}</p>
    </div>
  )
}

function KpiCard({ title, value, note }) {
  return (
    <div style={kpiCardStyle}>
      <div style={kpiTitleStyle}>{title}</div>
      <div style={kpiValueStyle}>{value}</div>
      <div style={kpiNoteStyle}>{note}</div>
    </div>
  )
}

function SectionCard({ title, children }) {
  return (
    <div style={cardStyle}>
      <h2 style={cardTitleStyle}>{title}</h2>
      <div style={cardTextStyle}>{children}</div>
    </div>
  )
}

const introStyle = { marginBottom: 20 }
const titleStyle = { margin: 0, fontSize: 30, color: '#111827' }
const subtitleStyle = { margin: '8px 0 0', color: '#6b7280' }

const kpiGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 16,
  marginBottom: 20,
}

const kpiCardStyle = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 16,
  padding: 18,
  boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
}

const kpiTitleStyle = { fontSize: 14, color: '#6b7280', marginBottom: 10 }
const kpiValueStyle = { fontSize: 28, fontWeight: 700, color: '#111827', marginBottom: 8 }
const kpiNoteStyle = { fontSize: 13, color: '#9ca3af' }

const cardStyle = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 16,
  padding: 22,
  marginBottom: 20,
  boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
}

const cardTitleStyle = { margin: '0 0 12px', fontSize: 20, color: '#111827' }
const cardTextStyle = { color: '#4b5563', lineHeight: 1.5 }
