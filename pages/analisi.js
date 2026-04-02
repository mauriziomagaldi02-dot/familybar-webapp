import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'

export default function Analisi() {
  const [user, setUser] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedPv, setSelectedPv] = useState('')
  const [message, setMessage] = useState('')
  const [data, setData] = useState({
    invoices: [],
    suppliers: [],
    pointsOfSale: [],
    categories: [],
    revenues: [],
    staffCosts: [],
    manualCosts: [],
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user || null))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) loadData()
  }, [user, selectedMonth, selectedPv])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  async function loadData() {
    setMessage('')

    let invoicesQuery = supabase.from('invoices').select('*')
    let revenuesQuery = supabase.from('revenues').select('*')
    let manualCostsQuery = supabase.from('manual_costs').select('*')
    let staffCostsQuery = supabase.from('staff_costs').select('*')

    if (selectedMonth) {
      const startDate = `${selectedMonth}-01`
      const endDate = `${getNextMonth(selectedMonth)}-01`

      invoicesQuery = invoicesQuery.gte('invoice_date', startDate).lt('invoice_date', endDate)
      revenuesQuery = revenuesQuery.gte('date', startDate).lt('date', endDate)
      manualCostsQuery = manualCostsQuery.gte('cost_date', startDate).lt('cost_date', endDate)
      staffCostsQuery = staffCostsQuery.eq('period_month', selectedMonth)
    }

    const [
      { data: invoices, error: invoicesError },
      { data: suppliers, error: suppliersError },
      { data: pointsOfSale, error: pointsOfSaleError },
      { data: categories, error: categoriesError },
      { data: revenues, error: revenuesError },
      { data: staffCosts, error: staffCostsError },
      { data: manualCosts, error: manualCostsError },
    ] = await Promise.all([
      invoicesQuery,
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('points_of_sale').select('*').order('name'),
      supabase.from('categories').select('*').order('name'),
      revenuesQuery,
      staffCostsQuery,
      manualCostsQuery,
    ])

    const err =
      invoicesError?.message ||
      suppliersError?.message ||
      pointsOfSaleError?.message ||
      categoriesError?.message ||
      revenuesError?.message ||
      staffCostsError?.message ||
      manualCostsError?.message

    if (err) {
      setMessage(err)
      return
    }

    setData({
      invoices: invoices || [],
      suppliers: suppliers || [],
      pointsOfSale: pointsOfSale || [],
      categories: categories || [],
      revenues: revenues || [],
      staffCosts: staffCosts || [],
      manualCosts: manualCosts || [],
    })
  }

  const filteredPointsOfSale = useMemo(() => {
    return (data.pointsOfSale || []).filter((pv) =>
      selectedPv ? String(pv.id) === String(selectedPv) : true
    )
  }, [data.pointsOfSale, selectedPv])

  const filteredInvoices = useMemo(() => {
    return (data.invoices || []).filter((i) =>
      selectedPv ? String(i.point_of_sale_id) === String(selectedPv) : true
    )
  }, [data.invoices, selectedPv])

  const filteredRevenues = useMemo(() => {
    return (data.revenues || []).filter((r) =>
      selectedPv ? String(r.point_of_sale_id) === String(selectedPv) : true
    )
  }, [data.revenues, selectedPv])

  const filteredStaff = useMemo(() => {
    return (data.staffCosts || []).filter((s) =>
      selectedPv ? String(s.point_of_sale_id) === String(selectedPv) : true
    )
  }, [data.staffCosts, selectedPv])

  const filteredManualCosts = useMemo(() => {
    return (data.manualCosts || []).filter((m) => {
      if (!selectedPv) return true
      if (m.is_general) return true
      return String(m.point_of_sale_id) === String(selectedPv)
    })
  }, [data.manualCosts, selectedPv])

  const summary = useMemo(() => {
    const ricavi = sumAmounts(filteredRevenues)
    const acquisti = sumAmounts(filteredInvoices)
    const costoPersonale = sumAmounts(filteredStaff)
    const speseManuali = sumAmounts(filteredManualCosts)
    const margine = ricavi - acquisti - costoPersonale - speseManuali

    return { ricavi, acquisti, costoPersonale, speseManuali, margine }
  }, [filteredRevenues, filteredInvoices, filteredStaff, filteredManualCosts])

  const supplierAnalysis = useMemo(() => {
    const total = sumAmounts(filteredInvoices)

    return data.suppliers
      .map((supplier) => {
        const rows = filteredInvoices.filter((i) => String(i.supplier_id) === String(supplier.id))
        const imponibile = sumAmounts(rows)
        const fatture = rows.length
        const incidenza = total > 0 ? (imponibile / total) * 100 : 0

        return {
          id: supplier.id,
          name: supplier.name,
          imponibile,
          fatture,
          incidenza,
        }
      })
      .filter((row) => row.imponibile > 0)
      .sort((a, b) => b.imponibile - a.imponibile)
  }, [filteredInvoices, data.suppliers])

  const paretoSuppliers = useMemo(() => {
    const total = supplierAnalysis.reduce((sum, row) => sum + row.imponibile, 0)
    let cumulato = 0

    return supplierAnalysis.map((row) => {
      cumulato += row.imponibile
      const cumulataPerc = total > 0 ? (cumulato / total) * 100 : 0

      return {
        ...row,
        cumulataPerc,
        inPareto80: cumulataPerc <= 80,
      }
    })
  }, [supplierAnalysis])

  const categoryAnalysis = useMemo(() => {
    return data.categories
      .map((cat) => {
        const rows = filteredInvoices.filter((i) => String(i.category_id) === String(cat.id))
        return {
          id: cat.id,
          name: cat.name,
          imponibile: sumAmounts(rows),
          fatture: rows.length,
        }
      })
      .filter((row) => row.imponibile > 0)
      .sort((a, b) => b.imponibile - a.imponibile)
  }, [filteredInvoices, data.categories])

  const pvAnalysis = useMemo(() => {
    return filteredPointsOfSale
      .map((pv) => {
        const ricavi = sumAmounts(filteredRevenues.filter((r) => String(r.point_of_sale_id) === String(pv.id)))
        const acquisti = sumAmounts(filteredInvoices.filter((i) => String(i.point_of_sale_id) === String(pv.id)))
        const costoPersonale = sumAmounts(filteredStaff.filter((s) => String(s.point_of_sale_id) === String(pv.id)))
        const speseManuali = sumAmounts(
          filteredManualCosts.filter((m) => !m.is_general && String(m.point_of_sale_id) === String(pv.id))
        )
        const ore = filteredStaff
          .filter((s) => String(s.point_of_sale_id) === String(pv.id))
          .reduce((sum, s) => sum + Number(s.worked_hours || 0), 0)

        const margine = ricavi - acquisti - costoPersonale - speseManuali
        const produttivita = ore > 0 ? ricavi / ore : 0
        const costoPersonalePerc = ricavi > 0 ? (costoPersonale / ricavi) * 100 : 0

        return {
          id: pv.id,
          name: pv.name,
          ricavi,
          acquisti,
          costoPersonale,
          speseManuali,
          margine,
          ore,
          produttivita,
          costoPersonalePerc,
        }
      })
      .sort((a, b) => b.ricavi - a.ricavi)
  }, [filteredPointsOfSale, filteredRevenues, filteredInvoices, filteredStaff, filteredManualCosts])

  const topSuppliersChart = supplierAnalysis.slice(0, 10)
  const categoriesChart = categoryAnalysis.slice(0, 10)
  const pvProductivityChart = [...pvAnalysis].sort((a, b) => b.produttivita - a.produttivita)

  if (!user) {
    return (
      <div style={{ padding: 40, fontFamily: 'Arial, sans-serif' }}>
        <p>Devi accedere</p>
        <Link href="/">Torna alla home</Link>
      </div>
    )
  }

  return (
    <Layout onLogout={handleLogout} compactMenu>
      <div style={pageHeaderStyle}>
        <h1 style={pageTitleStyle}>Analisi avanzata</h1>
      </div>

      <div style={filtersWrapStyle}>
        <label style={filterLabelStyle}>Mese</label>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={filterInputStyle}
        />

        <button type="button" onClick={() => setSelectedMonth('')} style={secondaryButtonStyle}>
          Tutti i mesi
        </button>

        <label style={filterLabelStyle}>PV</label>
        <select
          value={selectedPv}
          onChange={(e) => setSelectedPv(e.target.value)}
          style={filterInputStyle}
        >
          <option value="">Tutti i PV</option>
          {data.pointsOfSale.map((pv) => (
            <option key={pv.id} value={pv.id}>
              {pv.name}
            </option>
          ))}
        </select>
      </div>

      {message && <p style={errorTextStyle}>{message}</p>}

      <h2 style={sectionTitleStyle}>Riepilogo generale</h2>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Ricavi</th>
            <th style={th}>Acquisti imponibile</th>
            <th style={th}>Costo personale</th>
            <th style={th}>Spese manuali</th>
            <th style={th}>Margine</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={td}>{formatEuro(summary.ricavi)}</td>
            <td style={td}>{formatEuro(summary.acquisti)}</td>
            <td style={td}>{formatEuro(summary.costoPersonale)}</td>
            <td style={td}>{formatEuro(summary.speseManuali)}</td>
            <td style={{ ...td, ...getMargineStyle(summary.margine), fontWeight: 700 }}>
              {formatEuro(summary.margine)}
            </td>
          </tr>
        </tbody>
      </table>

      <h2 style={sectionTitleStyle}>Grafico top fornitori</h2>
      <BarChart
        rows={topSuppliersChart}
        valueKey="imponibile"
        labelKey="name"
        valueFormatter={formatEuro}
      />

      <h2 style={sectionTitleStyle}>Grafico categorie</h2>
      <BarChart
        rows={categoriesChart}
        valueKey="imponibile"
        labelKey="name"
        valueFormatter={formatEuro}
      />

      <h2 style={sectionTitleStyle}>Grafico produttività PV</h2>
      <BarChart
        rows={pvProductivityChart}
        valueKey="produttivita"
        labelKey="name"
        valueFormatter={formatEuro}
        threshold={40}
      />

      <h2 style={sectionTitleStyle}>Analisi per punto vendita</h2>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>PV</th>
            <th style={th}>Ricavi</th>
            <th style={th}>Acquisti</th>
            <th style={th}>Costo personale</th>
            <th style={th}>Spese manuali</th>
            <th style={th}>Margine</th>
            <th style={th}>Ore</th>
            <th style={th}>Produttività €/h</th>
            <th style={th}>Costo pers. % ricavi</th>
            <th style={th}>Stato</th>
          </tr>
        </thead>
        <tbody>
          {pvAnalysis.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.name}</td>
              <td style={td}>{formatEuro(row.ricavi)}</td>
              <td style={td}>{formatEuro(row.acquisti)}</td>
              <td style={td}>{formatEuro(row.costoPersonale)}</td>
              <td style={td}>{formatEuro(row.speseManuali)}</td>
              <td style={{ ...td, ...getMargineStyle(row.margine), fontWeight: 700 }}>
                {formatEuro(row.margine)}
              </td>
              <td style={td}>{formatNumber(row.ore)}</td>
              <td style={{ ...td, ...getProduttivitaStyle(row.produttivita) }}>
                {formatEuro(row.produttivita)}
              </td>
              <td style={{ ...td, ...getCostoPersonalePercStyle(row.costoPersonalePerc) }}>
                {formatPercent(row.costoPersonalePerc)}
              </td>
              <td style={td}>
                <span style={badgeStyle(getOverallStatus(row))}>
                  {getOverallStatusLabel(row)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={sectionTitleStyle}>Analisi per fornitore</h2>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Fornitore</th>
            <th style={th}>Imponibile</th>
            <th style={th}>N. fatture</th>
            <th style={th}>Incidenza % su acquisti</th>
          </tr>
        </thead>
        <tbody>
          {supplierAnalysis.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.name}</td>
              <td style={td}>{formatEuro(row.imponibile)}</td>
              <td style={td}>{row.fatture}</td>
              <td style={td}>{formatPercent(row.incidenza)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={sectionTitleStyle}>Pareto fornitori 80/20</h2>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Fornitore</th>
            <th style={th}>Imponibile</th>
            <th style={th}>Incidenza %</th>
            <th style={th}>Cumulata %</th>
            <th style={th}>Pareto</th>
          </tr>
        </thead>
        <tbody>
          {paretoSuppliers.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.name}</td>
              <td style={td}>{formatEuro(row.imponibile)}</td>
              <td style={td}>{formatPercent(row.incidenza)}</td>
              <td style={td}>{formatPercent(row.cumulataPerc)}</td>
              <td style={td}>
                <span style={badgeStyle(row.inPareto80 ? 'ok' : 'warn')}>
                  {row.inPareto80 ? 'Sì' : 'No'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={sectionTitleStyle}>Analisi per categoria</h2>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Categoria</th>
            <th style={th}>Imponibile</th>
            <th style={th}>N. fatture</th>
          </tr>
        </thead>
        <tbody>
          {categoryAnalysis.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.name}</td>
              <td style={td}>{formatEuro(row.imponibile)}</td>
              <td style={td}>{row.fatture}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  )
}

function BarChart({ rows, valueKey, labelKey, valueFormatter, threshold = null }) {
  const max = Math.max(...rows.map((r) => Number(r[valueKey] || 0)), 0)

  if (!rows.length) {
    return <p>Nessun dato disponibile.</p>
  }

  return (
    <div style={chartWrapStyle}>
      {rows.map((row, index) => {
        const value = Number(row[valueKey] || 0)
        const width = max > 0 ? (value / max) * 100 : 0
        const style =
          threshold !== null
            ? getProduttivitaBarStyle(value)
            : { background: '#5bc0de' }

        return (
          <div key={row.id || index} style={{ marginBottom: 14 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 16,
                marginBottom: 4,
                fontSize: 14,
              }}
            >
              <span>{row[labelKey]}</span>
              <span>{valueFormatter(value)}</span>
            </div>

            <div
              style={{
                height: 18,
                background: '#f1f1f1',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 6,
              }}
            >
              <div
                style={{
                  width: `${width}%`,
                  height: '100%',
                  ...style,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function getOverallStatus(row) {
  if (row.produttivita < 35 || row.margine < 0 || row.costoPersonalePerc > 35) return 'bad'
  if (row.produttivita < 40 || row.costoPersonalePerc > 30) return 'warn'
  return 'ok'
}

function getOverallStatusLabel(row) {
  const status = getOverallStatus(row)
  if (status === 'bad') return 'Critico'
  if (status === 'warn') return 'Attenzione'
  return 'Buono'
}

function getProduttivitaStyle(value) {
  if (value >= 40) return { background: '#dff0d8' }
  if (value >= 35) return { background: '#fcf8e3' }
  return { background: '#f2dede' }
}

function getProduttivitaBarStyle(value) {
  if (value >= 40) return { background: '#5cb85c' }
  if (value >= 35) return { background: '#f0ad4e' }
  return { background: '#d9534f' }
}

function getMargineStyle(value) {
  if (value >= 0) return { background: '#dff0d8' }
  return { background: '#f2dede' }
}

function getCostoPersonalePercStyle(value) {
  if (value <= 30) return { background: '#dff0d8' }
  if (value <= 35) return { background: '#fcf8e3' }
  return { background: '#f2dede' }
}

function badgeStyle(status) {
  if (status === 'ok') {
    return {
      display: 'inline-block',
      padding: '4px 8px',
      background: '#dff0d8',
      border: '1px solid #c3e6cb',
      borderRadius: 8,
    }
  }
  if (status === 'warn') {
    return {
      display: 'inline-block',
      padding: '4px 8px',
      background: '#fcf8e3',
      border: '1px solid #faebcc',
      borderRadius: 8,
    }
  }
  return {
    display: 'inline-block',
    padding: '4px 8px',
    background: '#f2dede',
    border: '1px solid #ebccd1',
    borderRadius: 8,
  }
}

function sumAmounts(rows) {
  return (rows || []).reduce((sum, row) => sum + Number(row.amount || 0), 0)
}

function getNextMonth(month) {
  const [year, mon] = month.split('-').map(Number)
  let nextYear = year
  let nextMonth = mon + 1

  if (nextMonth === 13) {
    nextMonth = 1
    nextYear = year + 1
  }

  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`
}

function formatEuro(value) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value || 0))
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`
}

function formatNumber(value) {
  return Number(value || 0).toFixed(2)
}

const pageHeaderStyle = {
  display: 'flex',
  gap: 16,
  alignItems: 'center',
  marginBottom: 20,
}

const pageTitleStyle = {
  margin: 0,
  color: '#111827',
  fontSize: 28,
}

const filtersWrapStyle = {
  marginTop: 20,
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  flexWrap: 'wrap',
  marginBottom: 8,
}

const filterLabelStyle = {
  fontSize: 14,
  fontWeight: 600,
  color: '#374151',
}

const filterInputStyle = {
  padding: '10px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 10,
  fontSize: 14,
  background: '#fff',
}

const secondaryButtonStyle = {
  padding: '10px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 10,
  background: '#fff',
  cursor: 'pointer',
  fontSize: 14,
}

const errorTextStyle = {
  color: '#b91c1c',
  marginTop: 16,
}

const sectionTitleStyle = {
  marginTop: 30,
  color: '#111827',
}

const chartWrapStyle = {
  border: '1px solid #ddd',
  padding: 16,
  marginTop: 12,
  borderRadius: 12,
  background: '#fff',
}

const table = {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: 12,
}

const th = {
  border: '1px solid #ccc',
  padding: 8,
  textAlign: 'left',
  background: '#f5f5f5',
}

const td = {
  border: '1px solid #ccc',
  padding: 8,
}
