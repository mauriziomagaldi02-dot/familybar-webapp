import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'

const initialData = {
  invoices: [],
  suppliers: [],
  pointsOfSale: [],
  categories: [],
  revenues: [],
  staffCosts: [],
  manualCosts: [],
}

export default function Analisi() {
  const [user, setUser] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedPv, setSelectedPv] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(initialData)

  const [supplierRowsPerPage, setSupplierRowsPerPage] = useState(10)
  const [supplierPage, setSupplierPage] = useState(1)
  const [paretoRowsPerPage, setParetoRowsPerPage] = useState(10)
  const [paretoPage, setParetoPage] = useState(1)

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
  }, [user])

  useEffect(() => {
    setSupplierPage(1)
    setParetoPage(1)
  }, [selectedMonth, selectedPv])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  async function loadData() {
    setLoading(true)

    const [
      { data: invoices },
      { data: suppliers },
      { data: pointsOfSale },
      { data: categories },
      { data: revenues },
      { data: staffCosts },
      { data: manualCosts },
    ] = await Promise.all([
      supabase.from('invoices').select('*'),
      supabase.from('suppliers').select('*'),
      supabase.from('points_of_sale').select('*'),
      supabase.from('categories').select('*'),
      supabase.from('revenues').select('*'),
      supabase.from('staff_costs').select('*'),
      supabase.from('manual_costs').select('*'),
    ])

    setData({
      invoices: invoices || [],
      suppliers: suppliers || [],
      pointsOfSale: pointsOfSale || [],
      categories: categories || [],
      revenues: revenues || [],
      staffCosts: staffCosts || [],
      manualCosts: manualCosts || [],
    })

    setLoading(false)
  }

  const dateRange = useMemo(() => {
    if (!selectedMonth) return null
    return {
      startDate: `${selectedMonth}-01`,
      endDate: `${getNextMonth(selectedMonth)}-01`,
    }
  }, [selectedMonth])

  const filteredInvoices = useMemo(() => {
    return data.invoices.filter((row) => {
      const matchPv = selectedPv ? String(row.point_of_sale_id) === selectedPv : true
      const matchMonth = dateRange
        ? row.invoice_date >= dateRange.startDate && row.invoice_date < dateRange.endDate
        : true
      return matchPv && matchMonth
    })
  }, [data.invoices, selectedPv, dateRange])

  const supplierAnalysis = useMemo(() => {
    const total = sumAmounts(filteredInvoices)
    let cumulato = 0

    return data.suppliers
      .map((supplier) => {
        const rows = filteredInvoices.filter((i) => i.supplier_id === supplier.id)
        const imponibile = sumAmounts(rows)
        const incidenza = total ? (imponibile / total) * 100 : 0

        return {
          id: supplier.id,
          name: supplier.name,
          imponibile,
          fatture: rows.length,
          incidenza,
        }
      })
      .filter((r) => r.imponibile > 0)
      .sort((a, b) => b.imponibile - a.imponibile)
      .map((row) => {
        cumulato += row.incidenza
        return { ...row, incidenzaCumulata: cumulato }
      })
  }, [filteredInvoices, data.suppliers])

  const paretoSuppliers = useMemo(() => {
    return supplierAnalysis.map((r) => ({
      ...r,
      cumulataPerc: r.incidenzaCumulata,
      inPareto80: r.incidenzaCumulata <= 80,
    }))
  }, [supplierAnalysis])

  // ================= EXPORT CSV =================

  function exportCSV(rows, fileName) {
    const headers = Object.keys(rows[0] || {})
    const csv = [
      headers.join(';'),
      ...rows.map((row) =>
        headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(';')
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${fileName}.csv`
    link.click()
  }

  function exportSupplierAnalysisCSV() {
    exportCSV(
      supplierAnalysis.map((r) => ({
        Fornitore: r.name,
        Imponibile: r.imponibile,
        Numero_Fatture: r.fatture,
        Incidenza: r.incidenza,
        Incidenza_Cumulata: r.incidenzaCumulata,
      })),
      'analisi_fornitore'
    )
  }

  function exportParetoSuppliersCSV() {
    exportCSV(
      paretoSuppliers.map((r) => ({
        Fornitore: r.name,
        Imponibile: r.imponibile,
        Incidenza: r.incidenza,
        Cumulata: r.cumulataPerc,
        Pareto: r.inPareto80 ? 'Si' : 'No',
      })),
      'pareto_fornitori'
    )
  }

  if (!user) return <p>Devi accedere</p>

  return (
    <Layout onLogout={handleLogout}>
      <h1>Analisi avanzata</h1>

      {/* ANALISI FORNITORE */}
      <h2>Analisi per fornitore</h2>

      <button onClick={exportSupplierAnalysisCSV}>
        Export CSV analisi fornitore
      </button>

      <table>
        <thead>
          <tr>
            <th>Fornitore</th>
            <th>Imponibile</th>
            <th>Fatture</th>
            <th>Incidenza</th>
            <th>Cumulata</th>
          </tr>
        </thead>
        <tbody>
          {supplierAnalysis.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{r.imponibile}</td>
              <td>{r.fatture}</td>
              <td>{r.incidenza.toFixed(2)}%</td>
              <td>{r.incidenzaCumulata.toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* PARETO */}
      <h2>Pareto fornitori</h2>

      <button onClick={exportParetoSuppliersCSV}>
        Export CSV pareto fornitori
      </button>

      <table>
        <thead>
          <tr>
            <th>Fornitore</th>
            <th>Imponibile</th>
            <th>Incidenza</th>
            <th>Cumulata</th>
            <th>Pareto</th>
          </tr>
        </thead>
        <tbody>
          {paretoSuppliers.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{r.imponibile}</td>
              <td>{r.incidenza.toFixed(2)}%</td>
              <td>{r.cumulataPerc.toFixed(2)}%</td>
              <td>{r.inPareto80 ? 'Si' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  )
}

// ================= UTILS =================

function sumAmounts(rows) {
  return rows.reduce((s, r) => s + Number(r.amount || 0), 0)
}

function getNextMonth(month) {
  const [y, m] = month.split('-').map(Number)
  return `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}`
}
