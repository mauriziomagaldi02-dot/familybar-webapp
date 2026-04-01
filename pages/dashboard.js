import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [rows, setRows] = useState([])
  const [pointsOfSale, setPointsOfSale] = useState([])
  const [message, setMessage] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [selectedPv, setSelectedPv] = useState('')
  const [trendMonths, setTrendMonths] = useState(6)

  const [revenues, setRevenues] = useState([])
  const [invoices, setInvoices] = useState([])
  const [staffCosts, setStaffCosts] = useState([])
  const [manualCosts, setManualCosts] = useState([])

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
  }, [user])

  useEffect(() => {
    buildDashboardRows()
  }, [revenues, invoices, staffCosts, manualCosts, pointsOfSale, selectedMonth, selectedPv])

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

    setPointsOfSale(pvData || [])
    setRevenues(revenuesData || [])
    setInvoices(invoicesData || [])
    setStaffCosts(staffData || [])
    setManualCosts(manualCostsData || [])
  }

  function buildDashboardRows() {
    const filteredRevenues = (revenues || []).filter((r) =>
      isInSelectedMonth(r.date, selectedMonth)
    )

    const filteredInvoices = (invoices || []).filter((i) =>
      isInSelectedMonth(i.invoice_date, selectedMonth)
    )

    const filteredStaff = (staffCosts || []).filter((s) =>
      isInSelectedMonth(s.period_month, selectedMonth)
    )

    const filteredManualCosts = (manualCosts || []).filter((c) =>
      isInSelectedMonth(c.cost_date, selectedMonth)
    )

    const filteredPvData = (pointsOfSale || []).filter((pv) =>
      selectedPv ? pv.id === selectedPv : true
    )

    const totalRicavi = filteredRevenues.reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0
    )

    const generalManualCosts = filteredManualCosts.filter((c) => c.is_general === true)

    const result = filteredPvData.map((pv) => {
      const ricavi = filteredRevenues
        .filter((r) => r.point_of_sale_id === pv.id)
        .reduce((sum, r) => sum + Number(r.amount || 0), 0)

      const costiFattureImponibile = filteredInvoices
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

        const numeroPv = filteredPvData.length || 1
        return sum + amount / numeroPv
      }, 0)

      const costiTotali =
        costiFattureImponibile + costoPersonale + speseManualiDirette + quotaGenerali

      const margine = ricavi - costiTotali
      const produttivitaOraria = ore > 0 ? ricavi / ore : 0
      const costoPersonalePerc = ricavi > 0 ? (costoPersonale / ricavi) * 100 : 0

      return {
        id: pv.id,
        nome: pv.name,
        ricavi,
        costiFattureImponibile,
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
        acc.costiFattureImponibile += row.costiFattureImponibile
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
        costiFattureImponibile: 0,
        costoPersonale: 0,
        speseManualiDirette: 0,
        quotaGenerali: 0,
        costiTotali: 0,
        margine: 0,
        ore: 0,
      }
    )
  }, [rows])

  const trendRows = useMemo(() => {
    const monthKeys = getLastMonths(selectedMonth, trendMonths)

    return monthKeys.map((monthKey, index) => {
      const revenuesInMonth = (revenues || []).filter(
        (r) =>
          isInSelectedMonth(r.date, monthKey) &&
          (selectedPv ? r.point_of_sale_id === selectedPv : true)
      )

      const invoicesInMonth = (invoices || []).filter(
        (i) =>
          isInSelectedMonth(i.invoice_date, monthKey) &&
          (selectedPv ? i.point_of_sale_id === selectedPv : true)
      )

      const staffInMonth = (staffCosts || []).filter(
        (s) =>
          isInSelectedMonth(s.period_month, monthKey) &&
          (selectedPv ? s.point_of_sale_id === selectedPv : true)
      )

      const manualCostsInMonth = (manualCosts || []).filter((c) =>
        isInSelectedMonth(c.cost_date, monthKey)
      )

      const filteredPvData = (pointsOfSale || []).filter((pv) =>
        selectedPv ? pv.id === selectedPv : true
      )

      const totalRicaviMese = (revenues || [])
        .filter((r) => isInSelectedMonth(r.date, monthKey))
        .reduce((sum, r) => sum + Number(r.amount || 0), 0)

      const ricavi = revenuesInMonth.reduce((sum, r) => sum + Number(r.amount || 0), 0)

      const costiFattureImponibile = invoicesInMonth.reduce(
        (sum, i) => sum + Number(i.amount || 0),
        0
      )

      const costoPersonale = staffInMonth.reduce(
        (sum, s) => sum + Number(s.amount || 0),
        0
      )

      const ore = staffInMonth.reduce(
        (sum, s) => sum + Number(s.worked_hours || 0),
        0
      )

      const speseManualiDirette = manualCostsInMonth
        .filter((c) => !c.is_general && (selectedPv ? c.point_of_sale_id === selectedPv : true))
        .reduce((sum, c) => sum + Number(c.amount || 0), 0)

      const generalManualCosts = manualCostsInMonth.filter((c) => c.is_general === true)

      const quotaGenerali = generalManualCosts.reduce((sum, c) => {
        const amount = Number(c.amount || 0)

        if (selectedPv) {
          if (totalRicaviMese > 0) {
            return sum + amount * (ricavi / totalRicaviMese)
          }

          const numeroPv = filteredPvData.length || 1
          return sum + amount / numeroPv
        }

        return sum + amount
      }, 0)

      const costiTotali =
        costiFattureImponibile + costoPersonale + speseManualiDirette + quotaGenerali

      const margine = ricavi - costiTotali
      const marginePerc = ricavi > 0 ? (margine / ricavi) * 100 : 0
      const produttivitaOraria = ore > 0 ? ricavi / ore : 0

      const prev = index > 0 ? monthKeys[index - 1] : null

      let trendRicaviPerc = null
      let trendMarginePerc = null

      if (prev) {
        const prevData = calculateMonthSnapshot({
          monthKey: prev,
          selectedPv,
          revenues,
          invoices,
          staffCosts,
          manualCosts,
          pointsOfSale,
        })

        trendRicaviPerc =
          prevData.ricavi !== 0
            ? ((ricavi - prevData.ricavi) / prevData.ricavi) * 100
            : null

        trendMarginePerc =
          prevData.margine !== 0
            ? ((margine - prevData.margine) / prevData.margine) * 100
            : null
      }

      return {
        monthKey,
        ricavi,
        costiFattureImponibile,
        costoPersonale,
        speseManualiDirette,
        quotaGenerali,
        costiTotali,
        margine,
        marginePerc,
        ore,
        produttivitaOraria,
        trendRicaviPerc,
        trendMarginePerc,
      }
    })
  }, [revenues, invoices, staffCosts, manualCosts, pointsOfSale, selectedMonth, selectedPv, trendMonths])

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

      <div
        style={{
          marginBottom: 20,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <label>Mese di riferimento</label>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        />

        <label>PV</label>
        <select
          value={selectedPv}
          onChange={(e) => setSelectedPv(e.target.value)}
        >
          <option value="">Tutti i PV</option>
          {pointsOfSale.map((pv) => (
            <option key={pv.id} value={pv.id}>
              {pv.name}
            </option>
          ))}
        </select>

        <label>Trend</label>
        <select
          value={trendMonths}
          onChange={(e) => setTrendMonths(Number(e.target.value))}
        >
          <option value={6}>Ultimi 6 mesi</option>
          <option value={12}>Ultimi 12 mesi</option>
        </select>
      </div>

      {message && <p style={{ color: 'red', marginTop: 16 }}>{message}</p>}

      <table style={table}>
        <thead>
          <tr>
            <th style={th}>PV</th>
            <th style={th}>Ricavi</th>
            <th style={th}>Costi fatture (imponibile)</th>
            <th style={th}>Costo personale</th>
            <th style={th}>Spese manuali dirette</th>
            <th style={th}>Quota costi generali</th>
            <th style={th}>Costi totali</th>
            <th style={th}>Margine €</th>
            <th style={th}>Ore</th>
            <th style={th}>Produttività €/h</th>
            <th style={th}>Costo pers. % ricavi</th>
            <th style={th}>Stato</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.nome}</td>
              <td style={td}>{formatEuro(row.ricavi)}</td>
              <td style={td}>{formatEuro(row.costiFattureImponibile)}</td>
              <td style={td}>{formatEuro(row.costoPersonale)}</td>
              <td style={td}>{formatEuro(row.speseManualiDirette)}</td>
              <td style={td}>{formatEuro(row.quotaGenerali)}</td>
              <td style={td}>{formatEuro(row.costiTotali)}</td>
              <td style={{ ...td, ...getMargineStyle(row.margine), fontWeight: 700 }}>
                {formatEuro(row.margine)}
              </td>
              <td style={td}>{formatNumber(row.ore)}</td>
              <td style={{ ...td, ...getProduttivitaStyle(row.produttivitaOraria) }}>
                {formatEuro(row.produttivitaOraria)}
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

          <tr>
            <td style={{ ...td, fontWeight: 700 }}>Totale</td>
            <td style={{ ...td, fontWeight: 700 }}>{formatEuro(totals.ricavi)}</td>
            <td style={{ ...td, fontWeight: 700 }}>{formatEuro(totals.costiFattureImponibile)}</td>
            <td style={{ ...td, fontWeight: 700 }}>{formatEuro(totals.costoPersonale)}</td>
            <td style={{ ...td, fontWeight: 700 }}>{formatEuro(totals.speseManualiDirette)}</td>
            <td style={{ ...td, fontWeight: 700 }}>{formatEuro(totals.quotaGenerali)}</td>
            <td style={{ ...td, fontWeight: 700 }}>{formatEuro(totals.costiTotali)}</td>
            <td style={{ ...td, ...getMargineStyle(totals.margine), fontWeight: 700 }}>
              {formatEuro(totals.margine)}
            </td>
            <td style={{ ...td, fontWeight: 700 }}>{formatNumber(totals.ore)}</td>
            <td
              style={{
                ...td,
                ...getProduttivitaStyle(totals.ore > 0 ? totals.ricavi / totals.ore : 0),
                fontWeight: 700,
              }}
            >
              {formatEuro(totals.ore > 0 ? totals.ricavi / totals.ore : 0)}
            </td>
            <td
              style={{
                ...td,
                ...getCostoPersonalePercStyle(
                  totals.ricavi > 0 ? (totals.costoPersonale / totals.ricavi) * 100 : 0
                ),
                fontWeight: 700,
              }}
            >
              {formatPercent(
                totals.ricavi > 0 ? (totals.costoPersonale / totals.ricavi) * 100 : 0
              )}
            </td>
            <td style={td}>
              <span
                style={badgeStyle(
                  getOverallStatus({
                    produttivitaOraria: totals.ore > 0 ? totals.ricavi / totals.ore : 0,
                    margine: totals.margine,
                    costoPersonalePerc:
                      totals.ricavi > 0 ? (totals.costoPersonale / totals.ricavi) * 100 : 0,
                  })
                )}
              >
                {getOverallStatusLabel({
                  produttivitaOraria: totals.ore > 0 ? totals.ricavi / totals.ore : 0,
                  margine: totals.margine,
                  costoPersonalePerc:
                    totals.ricavi > 0 ? (totals.costoPersonale / totals.ricavi) * 100 : 0,
                })}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: 32 }}>
        <h2 style={{ marginBottom: 12 }}>Trend mensile</h2>

        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Mese</th>
              <th style={th}>Ricavi</th>
              <th style={th}>Costi fatture</th>
              <th style={th}>Costo personale</th>
              <th style={th}>Spese manuali dirette</th>
              <th style={th}>Quota generali</th>
              <th style={th}>Costi totali</th>
              <th style={th}>Margine €</th>
              <th style={th}>Margine %</th>
              <th style={th}>Ore</th>
              <th style={th}>Produttività €/h</th>
              <th style={th}>Trend ricavi</th>
              <th style={th}>Trend margine</th>
            </tr>
          </thead>
          <tbody>
            {trendRows.map((row) => (
              <tr key={row.monthKey}>
                <td style={td}>{formatMonthLabel(row.monthKey)}</td>
                <td style={td}>{formatEuro(row.ricavi)}</td>
                <td style={td}>{formatEuro(row.costiFattureImponibile)}</td>
                <td style={td}>{formatEuro(row.costoPersonale)}</td>
                <td style={td}>{formatEuro(row.speseManualiDirette)}</td>
                <td style={td}>{formatEuro(row.quotaGenerali)}</td>
                <td style={td}>{formatEuro(row.costiTotali)}</td>
                <td style={{ ...td, ...getMargineStyle(row.margine), fontWeight: 700 }}>
                  {formatEuro(row.margine)}
                </td>
                <td style={td}>{formatPercent(row.marginePerc)}</td>
                <td style={td}>{formatNumber(row.ore)}</td>
                <td style={{ ...td, ...getProduttivitaStyle(row.produttivitaOraria) }}>
                  {formatEuro(row.produttivitaOraria)}
                </td>
                <td style={{ ...td, ...getTrendStyle(row.trendRicaviPerc) }}>
                  {formatTrend(row.trendRicaviPerc)}
                </td>
                <td style={{ ...td, ...getTrendStyle(row.trendMarginePerc) }}>
                  {formatTrend(row.trendMarginePerc)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function calculateMonthSnapshot({
  monthKey,
  selectedPv,
  revenues,
  invoices,
  staffCosts,
  manualCosts,
  pointsOfSale,
}) {
  const revenuesInMonth = (revenues || []).filter(
    (r) =>
      isInSelectedMonth(r.date, monthKey) &&
      (selectedPv ? r.point_of_sale_id === selectedPv : true)
  )

  const invoicesInMonth = (invoices || []).filter(
    (i) =>
      isInSelectedMonth(i.invoice_date, monthKey) &&
      (selectedPv ? i.point_of_sale_id === selectedPv : true)
  )

  const staffInMonth = (staffCosts || []).filter(
    (s) =>
      isInSelectedMonth(s.period_month, monthKey) &&
      (selectedPv ? s.point_of_sale_id === selectedPv : true)
  )

  const manualCostsInMonth = (manualCosts || []).filter((c) =>
    isInSelectedMonth(c.cost_date, monthKey)
  )

  const filteredPvData = (pointsOfSale || []).filter((pv) =>
    selectedPv ? pv.id === selectedPv : true
  )

  const totalRicaviMese = (revenues || [])
    .filter((r) => isInSelectedMonth(r.date, monthKey))
    .reduce((sum, r) => sum + Number(r.amount || 0), 0)

  const ricavi = revenuesInMonth.reduce((sum, r) => sum + Number(r.amount || 0), 0)

  const costiFattureImponibile = invoicesInMonth.reduce(
    (sum, i) => sum + Number(i.amount || 0),
    0
  )

  const costoPersonale = staffInMonth.reduce(
    (sum, s) => sum + Number(s.amount || 0),
    0
  )

  const ore = staffInMonth.reduce(
    (sum, s) => sum + Number(s.worked_hours || 0),
    0
  )

  const speseManualiDirette = manualCostsInMonth
    .filter((c) => !c.is_general && (selectedPv ? c.point_of_sale_id === selectedPv : true))
    .reduce((sum, c) => sum + Number(c.amount || 0), 0)

  const generalManualCosts = manualCostsInMonth.filter((c) => c.is_general === true)

  const quotaGenerali = generalManualCosts.reduce((sum, c) => {
    const amount = Number(c.amount || 0)

    if (selectedPv) {
      if (totalRicaviMese > 0) {
        return sum + amount * (ricavi / totalRicaviMese)
      }

      const numeroPv = filteredPvData.length || 1
      return sum + amount / numeroPv
    }

    return sum + amount
  }, 0)

  const costiTotali =
    costiFattureImponibile + costoPersonale + speseManualiDirette + quotaGenerali

  const margine = ricavi - costiTotali
  const marginePerc = ricavi > 0 ? (margine / ricavi) * 100 : 0
  const produttivitaOraria = ore > 0 ? ricavi / ore : 0

  return {
    ricavi,
    costiFattureImponibile,
    costoPersonale,
    speseManualiDirette,
    quotaGenerali,
    costiTotali,
    margine,
    marginePerc,
    ore,
    produttivitaOraria,
  }
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

function getLastMonths(endMonth, count) {
  const [year, month] = String(endMonth).split('-').map(Number)
  const result = []

  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(year, month - 1 - i, 1)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    result.push(`${y}-${m}`)
  }

  return result
}

function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-')
  const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
  return `${months[Number(month) - 1]} ${year}`
}

function getOverallStatus(row) {
  if (
    Number(row.produttivitaOraria || 0) < 35 ||
    Number(row.margine || 0) < 0 ||
    Number(row.costoPersonalePerc || 0) > 35
  ) {
    return 'bad'
  }

  if (
    Number(row.produttivitaOraria || 0) < 40 ||
    Number(row.costoPersonalePerc || 0) > 30
  ) {
    return 'warn'
  }

  return 'ok'
}

function getOverallStatusLabel(row) {
  const status = getOverallStatus(row)
  if (status === 'bad') return 'Critico'
  if (status === 'warn') return 'Attenzione'
  return 'Buono'
}

function getProduttivitaStyle(value) {
  if (Number(value || 0) >= 40) return { background: '#dff0d8' }
  if (Number(value || 0) >= 35) return { background: '#fcf8e3' }
  return { background: '#f2dede' }
}

function getMargineStyle(value) {
  if (Number(value || 0) >= 0) return { background: '#dff0d8' }
  return { background: '#f2dede' }
}

function getCostoPersonalePercStyle(value) {
  if (Number(value || 0) <= 30) return { background: '#dff0d8' }
  if (Number(value || 0) <= 35) return { background: '#fcf8e3' }
  return { background: '#f2dede' }
}

function getTrendStyle(value) {
  if (value === null || value === undefined) return {}
  if (Number(value) > 2) return { background: '#dff0d8', fontWeight: 700 }
  if (Number(value) < -2) return { background: '#f2dede', fontWeight: 700 }
  return { background: '#fcf8e3', fontWeight: 700 }
}

function badgeStyle(status) {
  if (status === 'ok') {
    return {
      display: 'inline-block',
      padding: '4px 8px',
      background: '#dff0d8',
      border: '1px solid #c3e6cb',
    }
  }

  if (status === 'warn') {
    return {
      display: 'inline-block',
      padding: '4px 8px',
      background: '#fcf8e3',
      border: '1px solid #faebcc',
    }
  }

  return {
    display: 'inline-block',
    padding: '4px 8px',
    background: '#f2dede',
    border: '1px solid #ebccd1',
  }
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

function formatTrend(value) {
  if (value === null || value === undefined) return 'n.d.'
  const symbol = value > 2 ? '↑' : value < -2 ? '↓' : '→'
  return `${symbol} ${Number(value).toFixed(2)}%`
}

const table = {
  borderCollapse: 'collapse',
  width: '100%',
  marginTop: 24,
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
