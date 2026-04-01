import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [rows, setRows] = useState([])
  const [message, setMessage] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())

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
    if (user) loadData()
  }, [user, selectedMonth])

  async function loadData() {
    setMessage('')

    const [
      { data: pvData, error: pvError },
      { data: revenuesData, error: revError },
      { data: invoicesData, error: invError },
      { data: staffData, error: staffError },
      { data: manualCostsData, error: manualError },
    ] = await Promise.all([
      supabase.from('points_of_sale').select('*').order('name'),
      supabase.from('revenues').select('*'),
      supabase.from('invoices').select('*'),
      supabase.from('staff_costs').select('*'),
      supabase.from('manual_costs').select('*'),
    ])

    const err =
      pvError?.message ||
      revError?.message ||
      invError?.message ||
      staffError?.message ||
      manualError?.message

    if (err) {
      setMessage(err)
      return
    }

    const filteredRevenues = (revenuesData || []).filter((r) =>
      isInSelectedMonth(r.date, selectedMonth)
    )

    const filteredInvoices = (invoicesData || []).filter((i) =>
      isInSelectedMonth(i.invoice_date, selectedMonth)
    )

    const filteredStaff = (staffData || []).filter((s) =>
      isInSelectedMonth(s.period_month, selectedMonth)
    )

    const filteredManualCosts = (manualCostsData || []).filter((c) =>
      isInSelectedMonth(c.cost_date, selectedMonth)
    )

    const totalRicavi = filteredRevenues.reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0
    )

    const generalManualCosts = filteredManualCosts.filter(
      (c) => c.is_general === true
    )

    const result = (pvData || []).map((pv) => {
      const ricavi = filteredRevenues
        .filter((r) => r.point_of_sale_id === pv.id)
        .reduce((sum, r) => sum + Number(r.amount || 0), 0)

      const costiFatture = filteredInvoices
        .filter((i) => i.point_of_sale_id === pv.id)
        .reduce((sum, i) => sum + Number(i.amount || 0), 0)

      const costoPersonale = filteredStaff
        .filter((s) => s.point_of_sale_id === pv.id)
        .reduce((sum, s) => sum + Number(s.amount || 0), 0)

      const ore = filteredStaff
        .filter((s) => s.point_of_sale_id === pv.id)
        .reduce((sum, s) => sum + Number(s.worked_hours || 0), 0)

      const speseManualiDirette = filteredManualCosts
        .filter((c) => !c.is_general && c.point_of_sale_id === pv.id)
        .reduce((sum, c) => sum + Number(c.amount || 0), 0)

      const quotaGenerali = generalManualCosts.reduce((sum, c) => {
        const amount = Number(c.amount || 0)

        if (totalRicavi > 0) {
          return sum + amount * (ricavi / totalRicavi)
        }

        const numeroPv = (pvData || []).length || 1
        return sum + amount / numeroPv
      }, 0)

      const costiTotali =
        costiFatture + costoPersonale + speseManualiDirette + quotaGenerali

      const margine = ricavi - costiTotali
      const produttivitaOraria = ore > 0 ? ricavi / ore : 0
      const costoPersonalePerc = ricavi > 0 ? (costoPersonale / ricavi) * 100 : 0

      return {
        id: pv.id,
        nome: pv.name,
        ricavi,
        costiFatture,
        costoPersonale,
        speseManualiDirette,
        quotaGenerali,
        costiTotali,
        margine,
        ore,
        produttivitaOraria,
        costoPersonalePerc,
      }
    })

    setRows(result)
  }

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.ricavi += row.ricavi
        acc.costiFatture += row.costiFatture
        acc.costoPersonale += row.costoPersonale
        acc.speseManualiDirette += row.speseManualiDirette
        acc.quotaGenerali += row.quotaGenerali
        acc.costiTotali += row.costiTotali
        acc.margine += row.margine
        acc.ore += row.ore
        return acc
      },
      {
        ricavi: 0,
        costiFatture: 0,
        costoPersonale: 0,
        speseManualiDirette: 0,
        quotaGenerali: 0,
        costiTotali: 0,
        margine: 0,
        ore: 0,
      }
    )
  }, [rows])

  if (!user) {
    return (
      <div style={{ padding: 40, fontFamily: 'Arial, sans-serif' }}>
        <p>Devi accedere</p>
        <Link href="/">Torna alla home</Link>
      </div>
    )
  }

  return (
    <div style={{ padding: 40, fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <Link href="/">Home</Link>
      </div>

      <div style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>Mese di riferimento</label>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        />
      </div>

      {message && <p style={{ color: 'red', marginTop: 16 }}>{message}</p>}

      <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 24 }}>
        <thead>
          <tr>
            <th style={th}>PV</th>
            <th style={th}>Ricavi</th>
            <th style={th}>Costi fatture</th>
            <th style={th}>Costo personale</th>
            <th style={th}>Spese manuali dirette</th>
            <th style={th}>Quota costi generali</th>
            <th style={th}>Costi totali</th>
            <th style={th}>Margine €</th>
            <th style={th}>Ore</th>
            <th style={th}>Produttività €/h</th>
            <th style={th}>Costo pers. % ricavi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.nome}</td>
              <td style={td}>{formatEuro(row.ricavi)}</td>
              <td style={td}>{formatEuro(row.costiFatture)}</td>
              <td style={td}>{formatEuro(row.costoPersonale)}</td>
              <td style={td}>{formatEuro(row.speseManualiDirette)}</td>
              <td style={td}>{formatEuro(row.quotaGenerali)}</td>
              <td style={td}>{formatEuro(row.costiTotali)}</td>
              <td style={{ ...td, fontWeight: 700 }}>{formatEuro(row.margine)}</td>
              <td style={td}>{formatNumber(row.ore)}</td>
              <td style={td}>{formatEuro(row.produttivitaOraria)}</td>
              <td style={td}>{formatPercent(row.costoPersonalePerc)}</td>
            </tr>
          ))}

          <tr>
            <td style={{ ...td, fontWeight: 700 }}>Totale</td>
            <td style={{ ...td, fontWeight: 700 }}>{formatEuro(totals.ricavi)}</td>
            <td style={{ ...td, fontWeight: 700 }}>{formatEuro(totals.costiFatture)}</td>
            <td style={{ ...td, fontWeight: 700 }}>{formatEuro(totals.costoPersonale)}</td>
            <td style={{ ...td, fontWeight: 700 }}>{formatEuro(totals.speseManualiDirette)}</td>
            <td style={{ ...td, fontWeight: 700 }}>{formatEuro(totals.quotaGenerali)}</td>
            <td style={{ ...td, fontWeight: 700 }}>{formatEuro(totals.costiTotali)}</td>
            <td style={{ ...td, fontWeight: 700 }}>{formatEuro(totals.margine)}</td>
            <td style={{ ...td, fontWeight: 700 }}>{formatNumber(totals.ore)}</td>
            <td style={{ ...td, fontWeight: 700 }}>
              {formatEuro(totals.ore > 0 ? totals.ricavi / totals.ore : 0)}
            </td>
            <td style={{ ...td, fontWeight: 700 }}>
              {formatPercent(totals.ricavi > 0 ? (totals.costoPersonale / totals.ricavi) * 100 : 0)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function isInSelectedMonth(value, selectedMonth) {
  if (!value || !selectedMonth) return false
  return String(value).slice(0, 7) === selectedMonth
}

function getCurrentMonth() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
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

const th = {
  border: '1px solid #ccc',
  padding: 8,
  textAlign: 'left',
  background: '#f5f5f5',
  fontSize: 14,
}

const td = {
  border: '1px solid #ccc',
  padding: 8,
  fontSize: 14,
}
