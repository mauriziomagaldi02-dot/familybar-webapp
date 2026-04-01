import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

export default function Analisi() {
  const [user, setUser] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedPv, setSelectedPv] = useState('')
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
  }, [])

  useEffect(() => {
    if (user) loadData()
  }, [user, selectedMonth])

  async function loadData() {
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
  }

  // 🔴 FILTRI GLOBALI
  const filteredInvoices = useMemo(() => {
    return data.invoices.filter(i =>
      (selectedMonth ? i.invoice_date?.slice(0,7) === selectedMonth : true) &&
      (selectedPv ? i.point_of_sale_id === selectedPv : true)
    )
  }, [data.invoices, selectedMonth, selectedPv])

  const filteredRevenues = useMemo(() => {
    return data.revenues.filter(r =>
      (selectedMonth ? r.date?.slice(0,7) === selectedMonth : true) &&
      (selectedPv ? r.point_of_sale_id === selectedPv : true)
    )
  }, [data.revenues, selectedMonth, selectedPv])

  const filteredStaff = useMemo(() => {
    return data.staffCosts.filter(s =>
      (selectedMonth ? s.period_month === selectedMonth : true) &&
      (selectedPv ? s.point_of_sale_id === selectedPv : true)
    )
  }, [data.staffCosts, selectedMonth, selectedPv])

  const filteredManualCosts = useMemo(() => {
    return data.manualCosts.filter(m =>
      (selectedMonth ? m.cost_date?.slice(0,7) === selectedMonth : true) &&
      (selectedPv ? m.point_of_sale_id === selectedPv : true)
    )
  }, [data.manualCosts, selectedMonth, selectedPv])

  // 🔵 SUMMARY
  const summary = useMemo(() => {
    const ricavi = sum(filteredRevenues)
    const acquisti = sum(filteredInvoices)
    const personale = sum(filteredStaff)
    const spese = sum(filteredManualCosts)

    return {
      ricavi,
      acquisti,
      personale,
      spese,
      margine: ricavi - acquisti - personale - spese,
    }
  }, [filteredRevenues, filteredInvoices, filteredStaff, filteredManualCosts])

  // 🔵 FORNITORI
  const supplierAnalysis = useMemo(() => {
    const total = sum(filteredInvoices)

    return data.suppliers
      .map(s => {
        const rows = filteredInvoices.filter(i => i.supplier_id === s.id)
        const tot = sum(rows)

        return {
          name: s.name,
          totale: tot,
          perc: total > 0 ? (tot / total) * 100 : 0,
        }
      })
      .filter(r => r.totale > 0)
      .sort((a,b) => b.totale - a.totale)
  }, [filteredInvoices, data.suppliers])

  if (!user) return <p>Login richiesto</p>

  return (
    <div style={{ padding: 40 }}>
      <h1>Analisi</h1>
      <Link href="/">Home</Link>

      <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        />

        <select
          value={selectedPv}
          onChange={(e) => setSelectedPv(e.target.value)}
        >
          <option value="">Tutti i PV</option>
          {data.pointsOfSale.map(pv => (
            <option key={pv.id} value={pv.id}>
              {pv.name}
            </option>
          ))}
        </select>
      </div>

      <h2 style={{ marginTop: 30 }}>Riepilogo</h2>
      <table style={table}>
        <tbody>
          <tr>
            <td>Ricavi</td>
            <td>{euro(summary.ricavi)}</td>
          </tr>
          <tr>
            <td>Acquisti</td>
            <td>{euro(summary.acquisti)}</td>
          </tr>
          <tr>
            <td>Personale</td>
            <td>{euro(summary.personale)}</td>
          </tr>
          <tr>
            <td>Margine</td>
            <td style={colorMargine(summary.margine)}>
              {euro(summary.margine)}
            </td>
          </tr>
        </tbody>
      </table>

      <h2 style={{ marginTop: 30 }}>Fornitori</h2>
      <table style={table}>
        <thead>
          <tr>
            <th>Fornitore</th>
            <th>€</th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>
          {supplierAnalysis.map((r,i) => (
            <tr key={i}>
              <td>{r.name}</td>
              <td>{euro(r.totale)}</td>
              <td>{r.perc.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// utils
function sum(arr){
  return arr.reduce((a,b)=>a+Number(b.amount||0),0)
}

function euro(v){
  return new Intl.NumberFormat('it-IT',{
    style:'currency',
    currency:'EUR'
  }).format(v||0)
}

function colorMargine(v){
  return v>=0
    ? {background:'#dff0d8'}
    : {background:'#f2dede'}
}

const table={
  borderCollapse:'collapse',
  marginTop:12
}
